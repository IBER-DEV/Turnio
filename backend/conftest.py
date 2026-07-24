import pytest
from rest_framework.test import APIClient

from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

PASSWORD_DUENO = "claveSegura123"


@pytest.fixture
def negocio_con_dueno(db):
    negocio, dueno, membresia = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Test",
        email_dueno="dueno@test.com",
        password_dueno=PASSWORD_DUENO,
        nombre_dueno="Dueño Test",
    )
    return negocio, dueno, membresia


@pytest.fixture
def servicio_de_prueba(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    return servicios_services.crear_servicio(
        negocio=negocio, nombre="Corte clásico", precio="20000", duracion_minutos=30
    )


@pytest.fixture
def cliente_autenticado_dueno(negocio_con_dueno):
    _negocio, dueno, _membresia = negocio_con_dueno
    client = APIClient()
    respuesta = client.post(
        "/api/auth/login/",
        {"email": dueno.email, "password": PASSWORD_DUENO},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
    return client
