"""Separación de `puede_gestionar_agenda` y visibilidad de citas.

Dos cambios que van juntos porque parten del mismo diagnóstico: una sola
capacidad estaba decidiendo cosas que un dueño quiere decidir por
separado.
"""

import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda import services
from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"
LUNES_10AM = timezone.make_aware(datetime.datetime(2024, 1, 1, 10, 0))

FRANJA_LUNES = [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}]


def _cliente_de(email):
    client = APIClient()
    respuesta = client.post(
        "/api/auth/login/", {"email": email, "password": PASSWORD}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
    return client


def _empleado(negocio, email, nombre, **capacidades):
    _usuario, membresia = negocios_services.agregar_empleado(
        negocio=negocio, email=email, password=PASSWORD, nombre=nombre, capacidades=capacidades
    )
    return _cliente_de(email), membresia


# --- El caso que motivó la separación: agendar sin decidir el horario ---


@pytest.fixture
def recepcionista(negocio_con_dueno):
    """Opera la agenda del día, pero no decide cuándo abre el local."""
    negocio, _dueno, _membresia = negocio_con_dueno
    return _empleado(
        negocio,
        "recepcion@test.com",
        "Recepcion",
        puede_gestionar_agenda=True,
        puede_ver_agenda_completa=True,
    )


def test_recepcionista_puede_agendar_citas(
    recepcionista, negocio_con_dueno, servicio_de_prueba, cliente_autenticado_dueno
):
    cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/", {"franjas": FRANJA_LUNES}, format="json"
    )
    client, _membresia = recepcionista

    respuesta = client.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente",
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data


def test_recepcionista_no_puede_cambiar_el_horario_del_negocio(recepcionista, negocio_con_dueno):
    """El caso exacto que pidió el humano: gestiona citas, no horarios."""
    negocio, _dueno, _membresia = negocio_con_dueno
    client, _membresia_recepcion = recepcionista

    respuesta = client.put(
        "/api/agenda/horario-negocio/",
        {"franjas": [{"dia_semana": 3, "hora_inicio": "07:00:00", "hora_fin": "23:00:00"}]},
        format="json",
    )

    assert respuesta.status_code == 403
    assert negocio.horarios.count() == 0


def test_recepcionista_no_puede_cambiar_el_horario_de_un_empleado(
    recepcionista, negocio_con_dueno
):
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    client, _membresia_recepcion = recepcionista

    respuesta = client.put(
        "/api/agenda/horarios/semana/",
        {"miembros": [membresia_dueno.id], "franjas": FRANJA_LUNES},
        format="json",
    )

    assert respuesta.status_code == 403
    assert membresia_dueno.horarios.count() == 0


def test_quien_configura_horarios_no_puede_agendar_citas(
    negocio_con_dueno, servicio_de_prueba, cliente_autenticado_dueno
):
    """La separación corta en las dos direcciones, no solo en una."""
    negocio, _dueno, _membresia = negocio_con_dueno
    cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/", {"franjas": FRANJA_LUNES}, format="json"
    )
    client, _membresia = _empleado(
        negocio, "rrhh@test.com", "RRHH", puede_configurar_horarios=True
    )

    respuesta = client.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente",
        },
        format="json",
    )

    assert respuesta.status_code == 403


def test_quien_configura_horarios_si_puede_cambiarlos(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    client, _membresia = _empleado(
        negocio, "rrhh@test.com", "RRHH", puede_configurar_horarios=True
    )

    respuesta = client.put(
        "/api/agenda/horario-negocio/", {"franjas": FRANJA_LUNES}, format="json"
    )

    assert respuesta.status_code == 200, respuesta.data
    assert negocio.horarios.count() == 1


# --- Visibilidad: la agenda completa es la libreta de clientes ---


def _cita_para(negocio, empleado, servicio, nombre_cliente, hora=LUNES_10AM):
    return services.agendar_cita(
        negocio=negocio,
        servicio=servicio,
        empleado=empleado,
        fecha_hora_inicio=hora,
        nombre_cliente=nombre_cliente,
        telefono_cliente="3001234567",
    )


@pytest.fixture
def negocio_con_dos_barberos(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio,
        franjas=[
            {
                "dia_semana": 0,
                "hora_inicio": datetime.time(9, 0),
                "hora_fin": datetime.time(18, 0),
            }
        ],
    )
    client_barbero, barbero = _empleado(negocio, "barbero@test.com", "Barbero")
    _cita_para(negocio, barbero, servicio_de_prueba, "Cliente Del Barbero")
    _cita_para(
        negocio,
        membresia_dueno,
        servicio_de_prueba,
        "Cliente Del Dueno",
        hora=LUNES_10AM + datetime.timedelta(hours=2),
    )
    return client_barbero, barbero, negocio


def test_empleado_sin_la_capacidad_solo_ve_sus_propias_citas(negocio_con_dos_barberos):
    client_barbero, _barbero, _negocio = negocio_con_dos_barberos

    respuesta = client_barbero.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    nombres = {cita["nombre_cliente"] for cita in respuesta.data}
    assert nombres == {"Cliente Del Barbero"}


def test_no_puede_leer_la_cita_ajena_ni_pidiendola_por_id(
    negocio_con_dos_barberos, servicio_de_prueba
):
    """Filtrar la lista no sirve de nada si el detalle sigue abierto."""
    client_barbero, _barbero, negocio = negocio_con_dos_barberos
    ajena = negocio.citas.get(nombre_cliente="Cliente Del Dueno")

    respuesta = client_barbero.get(f"/api/agenda/citas/{ajena.id}/")

    assert respuesta.status_code == 404


def test_no_puede_transicionar_una_cita_ajena(negocio_con_dos_barberos):
    client_barbero, _barbero, negocio = negocio_con_dos_barberos
    ajena = negocio.citas.get(nombre_cliente="Cliente Del Dueno")

    respuesta = client_barbero.post(f"/api/agenda/citas/{ajena.id}/confirmar/")

    assert respuesta.status_code == 404
    ajena.refresh_from_db()
    assert ajena.estado == "agendada"


def test_sigue_pudiendo_transicionar_las_propias(negocio_con_dos_barberos):
    """La propiedad sigue habilitando: el filtro no le quita al empleado
    el control de su propio trabajo."""
    client_barbero, _barbero, negocio = negocio_con_dos_barberos
    propia = negocio.citas.get(nombre_cliente="Cliente Del Barbero")

    respuesta = client_barbero.post(f"/api/agenda/citas/{propia.id}/confirmar/")

    assert respuesta.status_code == 200
    propia.refresh_from_db()
    assert propia.estado == "confirmada"


def test_con_la_capacidad_ve_toda_la_agenda(negocio_con_dos_barberos):
    client_barbero, barbero, _negocio = negocio_con_dos_barberos
    barbero.puede_ver_agenda_completa = True
    barbero.save(update_fields=["puede_ver_agenda_completa"])

    respuesta = client_barbero.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    nombres = {cita["nombre_cliente"] for cita in respuesta.data}
    assert nombres == {"Cliente Del Barbero", "Cliente Del Dueno"}


def test_el_dueno_ve_toda_la_agenda(negocio_con_dos_barberos, cliente_autenticado_dueno):
    respuesta = cliente_autenticado_dueno.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    assert len(respuesta.data) == 2


def test_el_telefono_del_cliente_ajeno_no_se_filtra(negocio_con_dos_barberos):
    """Lo que realmente se está protegiendo: la libreta de clientes."""
    client_barbero, _barbero, _negocio = negocio_con_dos_barberos

    respuesta = client_barbero.get("/api/agenda/citas/")

    telefonos_visibles = [cita["telefono_cliente"] for cita in respuesta.data]
    assert len(telefonos_visibles) == 1


# --- Alta de negocio: el dueño arranca con todas ---


def test_el_dueno_recibe_las_capacidades_nuevas_al_registrarse(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    assert membresia.puede_configurar_horarios is True
    assert membresia.puede_ver_agenda_completa is True


def test_mi_membresia_expone_las_capacidades_nuevas(cliente_autenticado_dueno):
    """El frontend decide qué renderizar con esto; si falta un flag,
    la UI no puede distinguir los casos."""
    respuesta = cliente_autenticado_dueno.get("/api/negocios/mi-membresia/")

    assert respuesta.status_code == 200
    assert respuesta.data["puede_configurar_horarios"] is True
    assert respuesta.data["puede_ver_agenda_completa"] is True


def test_el_alta_de_empleados_cubre_todas_las_capacidades_del_modelo():
    """Atrapa la deriva: agregar un flag al modelo y olvidarlo en el
    serializer de alta lo dejaría imposible de otorgar al crear."""
    from apps.negocios.serializers import EmpleadoAltaSerializer

    campos = set(EmpleadoAltaSerializer().get_fields())

    assert set(negocios_services.CAMPOS_CAPACIDADES) <= campos
