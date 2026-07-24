import pytest

from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db


def test_listar_servicios_no_expone_los_de_otro_negocio(cliente_autenticado_dueno, negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    servicios_services.crear_servicio(
        negocio=negocio, nombre="Corte propio", precio="20000", duracion_minutos=30
    )

    otro_negocio, _otro_dueno, _otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otro@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Otro Dueño",
    )
    servicios_services.crear_servicio(
        negocio=otro_negocio, nombre="Corte ajeno", precio="15000", duracion_minutos=20
    )

    respuesta = cliente_autenticado_dueno.get("/api/servicios/")

    assert respuesta.status_code == 200
    nombres = {servicio["nombre"] for servicio in respuesta.data}
    assert nombres == {"Corte propio"}


def test_crear_servicio_requiere_puede_editar_precios(negocio_con_dueno):
    from rest_framework.test import APIClient

    negocio, _dueno, _membresia = negocio_con_dueno
    negocios_services.agregar_empleado(
        negocio=negocio,
        email="empleado@test.com",
        password="claveSegura123",
        nombre="Empleado",
        capacidades={"puede_gestionar_agenda": True},
    )

    client = APIClient()
    login = client.post(
        "/api/auth/login/",
        {"email": "empleado@test.com", "password": "claveSegura123"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    respuesta = client.post(
        "/api/servicios/",
        {"nombre": "Corte", "precio": "20000", "duracion_minutos": 30},
        format="json",
    )

    assert respuesta.status_code == 403


def test_crear_servicio_rechaza_precio_negativo(cliente_autenticado_dueno):
    respuesta = cliente_autenticado_dueno.post(
        "/api/servicios/",
        {"nombre": "Corte", "precio": "-1", "duracion_minutos": 30},
        format="json",
    )

    assert respuesta.status_code == 400
