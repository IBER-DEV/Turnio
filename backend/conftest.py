import pytest
from rest_framework.test import APIClient

from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services
from apps.usuarios.models import Cargo

PASSWORD_DUENO = "claveSegura123"


@pytest.fixture
def empleado_con(db):
    """Da de alta a alguien en un cargo hecho a medida para el test.

    Desde que las capacidades viven en `Cargo` (2026-07-26), montar un
    empleado "que solo puede X" son dos pasos: crear el cargo y meterlo
    ahí. Esto los junta, para que los tests sigan leyéndose como
    "empleado con estas capacidades" y no como plomería de cargos.

    Devuelve `(membresia, cliente_autenticado)`.
    """

    def _crear(*, negocio, email, nombre="Empleado", capacidades=(), tipo=None, especialidad=""):
        cargo = negocios_services.crear_cargo(
            negocio=negocio,
            nombre=f"Cargo de {nombre} ({email})",
            tipo=tipo or Cargo.Tipo.OPERATIVO,
            capacidades=list(capacidades),
        )
        _usuario, membresia = negocios_services.agregar_empleado(
            negocio=negocio,
            email=email,
            password=PASSWORD_DUENO,
            nombre=nombre,
            especialidad=especialidad,
            cargo=cargo,
        )
        client = APIClient()
        respuesta = client.post(
            "/api/auth/login/", {"email": email, "password": PASSWORD_DUENO}, format="json"
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
        return membresia, client

    return _crear


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
