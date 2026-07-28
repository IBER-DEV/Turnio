import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import HorarioNegocio, HorarioTrabajo
from apps.negocios import services as negocios_services

pytestmark = pytest.mark.django_db

LUNES_10AM = timezone.make_aware(datetime.datetime(2024, 1, 1, 10, 0))


def _cargar_horario_lunes(cliente_autenticado_dueno, membresia):
    respuesta = cliente_autenticado_dueno.post(
        "/api/agenda/horarios/",
        {
            "miembro": membresia.id,
            "dia_semana": 0,
            "hora_inicio": "09:00:00",
            "hora_fin": "12:00:00",
        },
        format="json",
    )
    assert respuesta.status_code == 201, respuesta.data
    return respuesta.data


def test_crear_horario_via_api(cliente_autenticado_dueno, negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    _cargar_horario_lunes(cliente_autenticado_dueno, membresia)


def test_crear_horario_requiere_puede_configurar_horarios(negocio_con_dueno, empleado_con):
    """Tener otra capacidad no alcanza: los horarios tienen la suya
    propia desde que se separó de `puede_gestionar_agenda`."""
    negocio, _dueno, membresia = negocio_con_dueno
    _membresia, client = empleado_con(
        negocio=negocio,
        email="sinpermiso@test.com",
        nombre="Sin Permiso",
        capacidades=["puede_editar_precios"],
    )

    respuesta = client.post(
        "/api/agenda/horarios/",
        {"miembro": membresia.id, "dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "12:00:00"},
        format="json",
    )

    assert respuesta.status_code == 403


def test_agendar_cita_con_empleado_explicito(cliente_autenticado_dueno, negocio_con_dueno, servicio_de_prueba):
    _negocio, _dueno, membresia = negocio_con_dueno
    _cargar_horario_lunes(cliente_autenticado_dueno, membresia)

    respuesta = cliente_autenticado_dueno.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "empleado": membresia.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente Uno",
            "telefono_cliente": "3001234567",
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["estado"] == "agendada"
    assert respuesta.data["empleado"] == membresia.id


def test_agendar_cita_cualquiera_disponible_omite_empleado(
    cliente_autenticado_dueno, negocio_con_dueno, servicio_de_prueba
):
    _negocio, _dueno, membresia = negocio_con_dueno
    _cargar_horario_lunes(cliente_autenticado_dueno, membresia)

    respuesta = cliente_autenticado_dueno.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente Cualquiera",
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["empleado"] == membresia.id


def test_agendar_cita_sin_disponibilidad_devuelve_400(cliente_autenticado_dueno, servicio_de_prueba):
    respuesta = cliente_autenticado_dueno.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente Sin Cupo",
        },
        format="json",
    )

    assert respuesta.status_code == 400


def test_flujo_confirmar_completar_cita(cliente_autenticado_dueno, negocio_con_dueno, servicio_de_prueba):
    _negocio, _dueno, membresia = negocio_con_dueno
    _cargar_horario_lunes(cliente_autenticado_dueno, membresia)
    creacion = cliente_autenticado_dueno.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "empleado": membresia.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente Uno",
        },
        format="json",
    )
    cita_id = creacion.data["id"]

    confirmar = cliente_autenticado_dueno.post(f"/api/agenda/citas/{cita_id}/confirmar/")
    assert confirmar.status_code == 200
    assert confirmar.data["estado"] == "confirmada"

    completar = cliente_autenticado_dueno.post(f"/api/agenda/citas/{cita_id}/completar/")
    assert completar.status_code == 200
    assert completar.data["estado"] == "completada"

    cancelar = cliente_autenticado_dueno.post(f"/api/agenda/citas/{cita_id}/cancelar/")
    assert cancelar.status_code == 400


def test_lista_de_citas_no_expone_las_de_otro_tenant(cliente_autenticado_dueno, negocio_con_dueno, servicio_de_prueba):
    _negocio, _dueno, membresia = negocio_con_dueno
    _cargar_horario_lunes(cliente_autenticado_dueno, membresia)
    cliente_autenticado_dueno.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "empleado": membresia.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente Propio",
        },
        format="json",
    )

    otro_negocio, otro_dueno, otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otrodueno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Otro Dueño",
    )
    from apps.agenda import services as agenda_services
    from apps.servicios import services as servicios_services

    agenda_services.crear_horario(
        miembro=otra_membresia,
        dia_semana=0,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )
    otro_servicio = servicios_services.crear_servicio(
        negocio=otro_negocio, nombre="Otro servicio", precio="10000", duracion_minutos=20
    )
    agenda_services.agendar_cita(
        negocio=otro_negocio,
        servicio=otro_servicio,
        empleado=otra_membresia,
        fecha_hora_inicio=LUNES_10AM,
        nombre_cliente="Cliente Ajeno",
    )

    respuesta = cliente_autenticado_dueno.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    nombres = {cita["nombre_cliente"] for cita in respuesta.data}
    assert nombres == {"Cliente Propio"}


# --- PUT /api/agenda/horarios/semana/ ---


def test_semana_reemplaza_el_horario_completo_de_un_empleado(
    cliente_autenticado_dueno, negocio_con_dueno
):
    _negocio, _dueno, membresia = negocio_con_dueno

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [membresia.id],
            "franjas": [
                {"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "13:00:00"},
                {"dia_semana": 0, "hora_inicio": "14:00:00", "hora_fin": "18:00:00"},
                {"dia_semana": 1, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"},
            ],
        },
        format="json",
    )

    assert respuesta.status_code == 200
    assert len(respuesta.data) == 3
    assert membresia.horarios.count() == 3


def test_semana_rechaza_franjas_cruzadas_sin_tocar_lo_existente(
    cliente_autenticado_dueno, negocio_con_dueno
):
    _negocio, _dueno, membresia = negocio_con_dueno
    cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [membresia.id],
            "franjas": [{"dia_semana": 4, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}],
        },
        format="json",
    )

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [membresia.id],
            "franjas": [
                {"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "14:00:00"},
                {"dia_semana": 0, "hora_inicio": "13:00:00", "hora_fin": "18:00:00"},
            ],
        },
        format="json",
    )

    assert respuesta.status_code == 400
    # El horario del viernes que ya estaba cargado sigue intacto.
    assert list(membresia.horarios.values_list("dia_semana", flat=True)) == [4]


def test_semana_no_permite_editar_el_horario_de_otro_negocio(cliente_autenticado_dueno):
    otro_negocio, _otro_dueno, otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Ajena",
        email_dueno="ajeno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Ajeno",
    )

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [otra_membresia.id],
            "franjas": [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}],
        },
        format="json",
    )

    assert respuesta.status_code == 400
    assert otra_membresia.horarios.count() == 0


def test_semana_aplica_a_varios_empleados_en_un_request(
    cliente_autenticado_dueno, negocio_con_dueno
):
    negocio, _dueno, membresia = negocio_con_dueno
    _usuario, otro = negocios_services.agregar_empleado(
        negocio=negocio, email="otro@test.com", password="claveSegura123", nombre="Otro"
    )

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [membresia.id, otro.id],
            "franjas": [{"dia_semana": 5, "hora_inicio": "09:00:00", "hora_fin": "14:00:00"}],
        },
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data
    assert len(respuesta.data) == 2
    assert membresia.horarios.count() == 1
    assert otro.horarios.count() == 1


def test_semana_con_un_miembro_ajeno_en_la_lista_no_toca_a_ninguno(
    cliente_autenticado_dueno, negocio_con_dueno
):
    """Colar un id ajeno entre ids propios no debe pasar ni a medias."""
    _negocio, _dueno, membresia = negocio_con_dueno
    _otro_negocio, _otro_dueno, otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Ajena",
        email_dueno="ajeno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Ajeno",
    )

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [membresia.id, otra_membresia.id],
            "franjas": [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}],
        },
        format="json",
    )

    assert respuesta.status_code == 400
    assert membresia.horarios.count() == 0
    assert otra_membresia.horarios.count() == 0


def test_semana_rechaza_lista_de_miembros_vacia(cliente_autenticado_dueno):
    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horarios/semana/",
        {
            "miembros": [],
            "franjas": [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}],
        },
        format="json",
    )

    assert respuesta.status_code == 400


# --- GET/PUT /api/agenda/horario-negocio/ ---


def test_horario_negocio_se_carga_una_vez_y_lo_hereda_todo_el_equipo(
    cliente_autenticado_dueno, negocio_con_dueno, servicio_de_prueba
):
    """La mejora completa, de punta a punta: el dueño carga el horario del
    local y puede agendar con cualquiera sin configurar a nadie."""
    negocio, _dueno, _membresia = negocio_con_dueno
    negocios_services.agregar_empleado(
        negocio=negocio, email="empleada@test.com", password="claveSegura123", nombre="Empleada"
    )

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/",
        {"franjas": [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}]},
        format="json",
    )
    assert respuesta.status_code == 200, respuesta.data

    # Nadie tiene horario propio cargado...
    assert not HorarioTrabajo.objects.filter(miembro__negocio=negocio).exists()

    # ...y aun así se puede agendar "cualquiera disponible".
    cita = cliente_autenticado_dueno.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente",
        },
        format="json",
    )
    assert cita.status_code == 201, cita.data


def test_horario_negocio_lo_lee_cualquier_miembro_pero_solo_lo_edita_quien_gestiona_agenda(
    cliente_autenticado_dueno, negocio_con_dueno
):
    negocio, _dueno, _membresia = negocio_con_dueno
    cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/",
        {"franjas": [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}]},
        format="json",
    )
    negocios_services.agregar_empleado(
        negocio=negocio, email="raso@test.com", password="claveSegura123", nombre="Raso"
    )
    cliente_raso = APIClient()
    login = cliente_raso.post(
        "/api/auth/login/",
        {"email": "raso@test.com", "password": "claveSegura123"},
        format="json",
    )
    cliente_raso.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    lectura = cliente_raso.get("/api/agenda/horario-negocio/")
    assert lectura.status_code == 200
    assert len(lectura.data) == 1

    escritura = cliente_raso.put(
        "/api/agenda/horario-negocio/",
        {"franjas": [{"dia_semana": 1, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}]},
        format="json",
    )
    assert escritura.status_code == 403
    assert negocio.horarios.count() == 1


def test_horario_negocio_no_deja_ver_el_de_otro_negocio(cliente_autenticado_dueno):
    otro_negocio, _otro_dueno, _otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Ajena",
        email_dueno="ajeno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Ajeno",
    )
    HorarioNegocio.objects.create(
        tenant=otro_negocio.tenant,
        negocio=otro_negocio,
        dia_semana=0,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(18, 0),
    )

    respuesta = cliente_autenticado_dueno.get("/api/agenda/horario-negocio/")

    assert respuesta.status_code == 200
    assert respuesta.data == []


def test_horario_negocio_rechaza_franjas_cruzadas_sin_tocar_lo_existente(
    cliente_autenticado_dueno, negocio_con_dueno
):
    negocio, _dueno, _membresia = negocio_con_dueno
    cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/",
        {"franjas": [{"dia_semana": 4, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}]},
        format="json",
    )

    respuesta = cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/",
        {
            "franjas": [
                {"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "14:00:00"},
                {"dia_semana": 0, "hora_inicio": "13:00:00", "hora_fin": "18:00:00"},
            ]
        },
        format="json",
    )

    assert respuesta.status_code == 400
    assert list(negocio.horarios.values_list("dia_semana", flat=True)) == [4]


# --- Transiciones sobre citas propias, sin puede_gestionar_agenda ---


def _barbero_sin_gestion_de_agenda(negocio):
    """Un barbero raso: atiende clientes, no administra la agenda."""
    _usuario, membresia = negocios_services.agregar_empleado(
        negocio=negocio,
        email="raso@test.com",
        password="claveSegura123",
        nombre="Barbero Raso",
    )
    client = APIClient()
    login = client.post(
        "/api/auth/login/",
        {"email": "raso@test.com", "password": "claveSegura123"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return membresia, client


def _cita_para(negocio, membresia, servicio, dia_semana=0, hora=LUNES_10AM):
    from apps.agenda import services as agenda_services

    agenda_services.crear_horario(
        miembro=membresia,
        dia_semana=dia_semana,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(18, 0),
    )
    return agenda_services.agendar_cita(
        negocio=negocio,
        servicio=servicio,
        empleado=membresia,
        fecha_hora_inicio=hora,
        nombre_cliente="Cliente de Prueba",
    )


def test_empleado_sin_gestionar_agenda_puede_confirmar_su_propia_cita(
    negocio_con_dueno, servicio_de_prueba
):
    """El hueco que cerró este cambio: antes daba 403 sobre su propia cita."""
    negocio, _dueno, _membresia = negocio_con_dueno
    membresia_raso, client = _barbero_sin_gestion_de_agenda(negocio)
    cita = _cita_para(negocio, membresia_raso, servicio_de_prueba)

    respuesta = client.post(f"/api/agenda/citas/{cita.id}/confirmar/")

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data["estado"] == "confirmada"


def test_empleado_sin_gestionar_agenda_puede_completar_lo_suyo(
    negocio_con_dueno, servicio_de_prueba
):
    negocio, _dueno, _membresia = negocio_con_dueno
    membresia_raso, client = _barbero_sin_gestion_de_agenda(negocio)
    cita = _cita_para(negocio, membresia_raso, servicio_de_prueba)

    client.post(f"/api/agenda/citas/{cita.id}/confirmar/")
    respuesta = client.post(f"/api/agenda/citas/{cita.id}/completar/")

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data["estado"] == "completada"


def test_empleado_sin_gestionar_agenda_puede_cancelar_lo_suyo(
    negocio_con_dueno, servicio_de_prueba
):
    negocio, _dueno, _membresia = negocio_con_dueno
    membresia_raso, client = _barbero_sin_gestion_de_agenda(negocio)
    cita = _cita_para(negocio, membresia_raso, servicio_de_prueba)

    respuesta = client.post(f"/api/agenda/citas/{cita.id}/cancelar/")

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data["estado"] == "cancelada"


def test_empleado_sin_gestionar_agenda_no_puede_tocar_la_cita_de_otro(
    negocio_con_dueno, servicio_de_prueba
):
    """La propiedad habilita solo lo propio: la agenda ajena sigue cerrada.

    Devolvía `403` hasta que se agregó `puede_ver_agenda_completa`
    (2026-07-26): ahora el queryset ya no incluye las citas ajenas, así que
    el filtro responde antes que el permiso. `404` es además la respuesta
    correcta —un recurso que no puedes ver no debe distinguirse de uno que
    no existe (`CONTRATO.md` 5.2)—; el `403` anterior confirmaba que la
    cita existía.
    """
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    _membresia_raso, client = _barbero_sin_gestion_de_agenda(negocio)
    cita_del_dueno = _cita_para(negocio, membresia_dueno, servicio_de_prueba)

    respuesta = client.post(f"/api/agenda/citas/{cita_del_dueno.id}/confirmar/")

    assert respuesta.status_code == 404
    cita_del_dueno.refresh_from_db()
    assert cita_del_dueno.estado == "agendada"


def test_empleado_sin_gestionar_agenda_sigue_sin_poder_crear_citas(
    negocio_con_dueno, servicio_de_prueba
):
    """Crear es administrar la agenda del negocio: no hay 'cita propia'
    que justifique agendarla uno mismo."""
    negocio, _dueno, _membresia = negocio_con_dueno
    membresia_raso, client = _barbero_sin_gestion_de_agenda(negocio)
    _cita_para(negocio, membresia_raso, servicio_de_prueba, hora=LUNES_10AM)

    respuesta = client.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": (LUNES_10AM + datetime.timedelta(hours=2)).isoformat(),
            "nombre_cliente": "Cliente",
        },
        format="json",
    )

    assert respuesta.status_code == 403
