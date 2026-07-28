"""La cara pública: lo que se ve, lo que NO se ve, y lo que se puede hacer.

La mitad de estos tests son negativos a propósito. Es la única superficie
del proyecto sin autenticación, así que lo que importa no es solo que
funcione sino que no cuente de más.
"""

import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda import services as agenda_services
from apps.negocios import services as negocios_services
from apps.negocios.models import SLUGS_RESERVADOS, Negocio
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"


def _proximo_lunes(semanas=1):
    hoy = timezone.localdate()
    return hoy + datetime.timedelta(days=(7 - hoy.weekday()) % 7 + 7 * semanas)


@pytest.fixture
def anonimo():
    """Un cliente HTTP sin credenciales: internet abierto."""
    return APIClient()


@pytest.fixture
def barberia(db):
    negocio, _dueno, membresia = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Pública",
        email_dueno="publico@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Dueño Público",
        ciudad="Bogotá",
        direccion="Calle 1 #2-3",
        telefono="3001112233",
    )
    membresia.especialidad = "Barbero"
    membresia.save(update_fields=["especialidad"])
    servicio = servicios_services.crear_servicio(
        negocio=negocio, nombre="Corte clásico", precio="20000", duracion_minutos=30
    )
    agenda_services.reemplazar_horario_negocio(
        negocio=negocio,
        franjas=[
            {
                "dia_semana": dia,
                "hora_inicio": datetime.time(9, 0),
                "hora_fin": datetime.time(12, 0),
            }
            for dia in range(7)
        ],
    )
    return negocio, servicio, membresia


# --- Slugs reservados: que nadie se quede con una ruta de la app ---


def test_un_negocio_no_puede_quedarse_con_una_ruta_de_la_app(db):
    negocio, _dueno, _m = negocios_services.registrar_negocio(
        nombre_negocio="Agenda",
        email_dueno="agenda@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Dueño",
    )

    assert negocio.slug != "agenda"
    assert negocio.slug not in SLUGS_RESERVADOS


def test_las_rutas_reservadas_cubren_las_que_la_app_usa_hoy():
    """Si mañana nace una ruta nueva del staff, hay que reservarla acá."""
    assert {"login", "agenda", "servicios", "empleados", "configuracion"} <= SLUGS_RESERVADOS


def test_un_nombre_sin_letras_no_deja_el_slug_vacio(db):
    """Un slug vacío haría que el perfil público fuera la raíz del sitio."""
    negocio, _dueno, _m = negocios_services.registrar_negocio(
        nombre_negocio="+++",
        email_dueno="simbolos@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Dueño",
    )

    assert negocio.slug


def test_dos_negocios_con_el_mismo_nombre_no_chocan(db):
    for indice in range(2):
        negocios_services.registrar_negocio(
            nombre_negocio="Barbería El Corte",
            email_dueno=f"repe{indice}@test.com",
            password_dueno=PASSWORD,
            nombre_dueno="Dueño",
        )

    assert Negocio.objects.filter(nombre="Barbería El Corte").count() == 2
    assert len({n.slug for n in Negocio.objects.all()}) == 2


# --- Búsqueda ---


def test_cualquiera_puede_buscar_negocios_sin_sesion(anonimo, barberia):
    respuesta = anonimo.get("/api/publico/negocios/")

    assert respuesta.status_code == 200
    assert any(item["nombre"] == "Barbería Pública" for item in respuesta.data)


def test_la_busqueda_filtra_por_nombre_y_ciudad(anonimo, barberia):
    negocios_services.registrar_negocio(
        nombre_negocio="Spa Relax",
        email_dueno="spa@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Dueña",
        ciudad="Medellín",
    )

    por_nombre = anonimo.get("/api/publico/negocios/?q=spa")
    por_ciudad = anonimo.get("/api/publico/negocios/?ciudad=bogotá")

    assert [item["nombre"] for item in por_nombre.data] == ["Spa Relax"]
    assert [item["nombre"] for item in por_ciudad.data] == ["Barbería Pública"]


def test_un_negocio_inactivo_desaparece_de_internet(anonimo, barberia):
    negocio, _servicio, _membresia = barberia
    negocio.activo = False
    negocio.save(update_fields=["activo"])

    listado = anonimo.get("/api/publico/negocios/")
    perfil = anonimo.get(f"/api/publico/negocios/{negocio.slug}/")

    assert listado.data == []
    assert perfil.status_code == 404


# --- Perfil público: lo que se ve y lo que no ---


def test_el_perfil_muestra_servicios_profesionales_y_horario(anonimo, barberia):
    negocio, _servicio, _membresia = barberia

    respuesta = anonimo.get(f"/api/publico/negocios/{negocio.slug}/")

    assert respuesta.status_code == 200
    assert respuesta.data["nombre"] == "Barbería Pública"
    assert [s["nombre"] for s in respuesta.data["servicios"]] == ["Corte clásico"]
    assert respuesta.data["profesionales"][0]["especialidad"] == "Barbero"
    assert len(respuesta.data["horario"]) == 7


def test_el_perfil_no_expone_la_comision_de_los_servicios(anonimo, barberia):
    """`porcentaje_comision` es un acuerdo interno entre el negocio y su
    gente; no tiene por qué llegarle a un cliente."""
    negocio, _servicio, _membresia = barberia

    respuesta = anonimo.get(f"/api/publico/negocios/{negocio.slug}/")

    assert "porcentaje_comision" not in respuesta.data["servicios"][0]


def test_el_perfil_no_expone_email_ni_cargo_del_equipo(anonimo, barberia):
    negocio, _servicio, _membresia = barberia

    respuesta = anonimo.get(f"/api/publico/negocios/{negocio.slug}/")

    assert set(respuesta.data["profesionales"][0]) == {"id", "nombre", "especialidad"}


def test_el_perfil_no_muestra_servicios_ni_empleados_inactivos(anonimo, barberia):
    negocio, servicio, membresia = barberia
    servicio.activo = False
    servicio.save(update_fields=["activo"])
    _usuario, otro = negocios_services.agregar_empleado(
        negocio=negocio, email="inactivo@test.com", password=PASSWORD, nombre="Inactivo"
    )
    otro.activo = False
    otro.save(update_fields=["activo"])

    respuesta = anonimo.get(f"/api/publico/negocios/{negocio.slug}/")

    assert respuesta.data["servicios"] == []
    assert [p["nombre"] for p in respuesta.data["profesionales"]] == ["Dueño Público"]


# --- Disponibilidad ---


def test_la_disponibilidad_devuelve_huecos_del_horario(anonimo, barberia):
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()

    respuesta = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": lunes.isoformat()},
    )

    assert respuesta.status_code == 200
    # 9:00 a 12:00, servicio de 30 min, paso de 15: el último que cabe
    # entero empieza 11:30 → 9:00, 9:15 … 11:30 = 11 huecos.
    assert len(respuesta.data) == 11


def test_una_cita_existente_tapa_su_hueco_sin_revelarla(anonimo, barberia):
    negocio, servicio, membresia = barberia
    lunes = _proximo_lunes()
    cuando = timezone.make_aware(datetime.datetime.combine(lunes, datetime.time(9, 0)))
    agenda_services.agendar_cita(
        negocio=negocio,
        servicio=servicio,
        empleado=membresia,
        fecha_hora_inicio=cuando,
        nombre_cliente="Cliente Privado",
        telefono_cliente="3009998877",
    )

    respuesta = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": lunes.isoformat()},
    )

    cuerpo = str(respuesta.data)
    assert "Cliente Privado" not in cuerpo
    assert "3009998877" not in cuerpo
    # El hueco de las 9:00 y los que se solapan con la cita desaparecen.
    assert len(respuesta.data) == 9


def test_no_se_ofrecen_huecos_de_un_dia_sin_horario(anonimo, barberia):
    negocio, servicio, _membresia = barberia
    agenda_services.reemplazar_horario_negocio(negocio=negocio, franjas=[])

    respuesta = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": _proximo_lunes().isoformat()},
    )

    assert respuesta.data == []


def test_no_se_ofrecen_huecos_en_el_pasado(barberia):
    """Se prueba en el servicio para poder fijar el reloj."""
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()
    # Un "ahora" a las 11 de ese mismo día deja solo 11:00 y 11:15
    # (los que empiezan después y caben antes de las 12).
    ahora = timezone.make_aware(datetime.datetime.combine(lunes, datetime.time(11, 0)))

    huecos = agenda_services.huecos_disponibles(
        negocio=negocio, servicio=servicio, fecha=lunes, ahora=ahora
    )

    assert [h.time() for h in huecos] == [datetime.time(11, 15), datetime.time(11, 30)]


def test_no_se_puede_consultar_un_servicio_de_otro_negocio(anonimo, barberia):
    negocio, _servicio, _membresia = barberia
    otro_negocio, _d, _m = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Ajena",
        email_dueno="ajena@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Ajeno",
    )
    ajeno = servicios_services.crear_servicio(
        negocio=otro_negocio, nombre="Corte ajeno", precio="30000", duracion_minutos=30
    )

    respuesta = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": ajeno.id, "fecha": _proximo_lunes().isoformat()},
    )

    assert respuesta.status_code == 404


# --- Reserva ---


def test_un_cliente_reserva_sin_cuenta(anonimo, barberia):
    """El flujo completo que reemplaza al WhatsApp."""
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()
    huecos = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": lunes.isoformat()},
    ).data

    respuesta = anonimo.post(
        f"/api/publico/negocios/{negocio.slug}/reservar/",
        {
            "servicio": servicio.id,
            "fecha_hora_inicio": huecos[0]["inicio"],
            "nombre_cliente": "Ana Cliente",
            "telefono_cliente": "3001234567",
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["nombre_cliente"] == "Ana Cliente"
    assert respuesta.data["profesional"] == "Dueño Público"
    assert negocio.citas.count() == 1


def test_reservar_dos_veces_el_mismo_hueco_falla_sin_delatar_por_que(anonimo, barberia):
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()
    hueco = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": lunes.isoformat()},
    ).data[0]["inicio"]
    cuerpo = {
        "servicio": servicio.id,
        "fecha_hora_inicio": hueco,
        "nombre_cliente": "Primero",
        "telefono_cliente": "3001111111",
    }
    anonimo.post(f"/api/publico/negocios/{negocio.slug}/reservar/", cuerpo, format="json")

    segunda = anonimo.post(
        f"/api/publico/negocios/{negocio.slug}/reservar/",
        {**cuerpo, "nombre_cliente": "Segundo"},
        format="json",
    )

    assert segunda.status_code == 400
    assert "Primero" not in str(segunda.data)
    assert negocio.citas.count() == 1


def test_no_se_puede_reservar_fuera_del_horario(anonimo, barberia):
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()
    medianoche = timezone.make_aware(datetime.datetime.combine(lunes, datetime.time(3, 0)))

    respuesta = anonimo.post(
        f"/api/publico/negocios/{negocio.slug}/reservar/",
        {
            "servicio": servicio.id,
            "fecha_hora_inicio": medianoche.isoformat(),
            "nombre_cliente": "Trasnochador",
            "telefono_cliente": "3001234567",
        },
        format="json",
    )

    assert respuesta.status_code == 400
    assert negocio.citas.count() == 0


def test_no_se_puede_reservar_en_un_negocio_inactivo(anonimo, barberia):
    negocio, servicio, _membresia = barberia
    negocio.activo = False
    negocio.save(update_fields=["activo"])

    respuesta = anonimo.post(
        f"/api/publico/negocios/{negocio.slug}/reservar/",
        {
            "servicio": servicio.id,
            "fecha_hora_inicio": timezone.now().isoformat(),
            "nombre_cliente": "Ana",
            "telefono_cliente": "3001234567",
        },
        format="json",
    )

    assert respuesta.status_code == 404


def test_la_reserva_no_devuelve_datos_del_negocio_ni_de_otros_clientes(anonimo, barberia):
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()
    hueco = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": lunes.isoformat()},
    ).data[0]["inicio"]

    respuesta = anonimo.post(
        f"/api/publico/negocios/{negocio.slug}/reservar/",
        {
            "servicio": servicio.id,
            "fecha_hora_inicio": hueco,
            "nombre_cliente": "Ana",
            "telefono_cliente": "3001234567",
        },
        format="json",
    )

    assert set(respuesta.data) == {
        "negocio",
        "servicio",
        "profesional",
        "fecha_hora_inicio",
        "fecha_hora_fin",
        "nombre_cliente",
    }


def test_la_cita_reservada_le_aparece_al_negocio(anonimo, barberia):
    """De punta a punta: lo que entra por la web pública es una cita normal
    en la agenda del staff."""
    negocio, servicio, _membresia = barberia
    lunes = _proximo_lunes()
    hueco = anonimo.get(
        f"/api/publico/negocios/{negocio.slug}/disponibilidad/",
        {"servicio": servicio.id, "fecha": lunes.isoformat()},
    ).data[0]["inicio"]
    anonimo.post(
        f"/api/publico/negocios/{negocio.slug}/reservar/",
        {
            "servicio": servicio.id,
            "fecha_hora_inicio": hueco,
            "nombre_cliente": "Ana Cliente",
            "telefono_cliente": "3001234567",
        },
        format="json",
    )

    staff = APIClient()
    login = staff.post(
        "/api/auth/login/", {"email": "publico@test.com", "password": PASSWORD}, format="json"
    )
    staff.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    agenda = staff.get("/api/agenda/citas/")

    assert [cita["nombre_cliente"] for cita in agenda.data] == ["Ana Cliente"]
    assert agenda.data[0]["estado"] == "agendada"
