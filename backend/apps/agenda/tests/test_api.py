import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

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


def test_crear_horario_requiere_puede_gestionar_agenda(negocio_con_dueno):
    negocio, _dueno, membresia = negocio_con_dueno
    negocios_services.agregar_empleado(
        negocio=negocio,
        email="sinpermiso@test.com",
        password="claveSegura123",
        nombre="Sin Permiso",
        capacidades={"puede_editar_precios": True},
    )

    client = APIClient()
    login = client.post(
        "/api/auth/login/",
        {"email": "sinpermiso@test.com", "password": "claveSegura123"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

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
