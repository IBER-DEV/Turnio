"""Que `puede_gestionar_empleados` no sea una escalada de privilegios.

Antes de estas reglas, esa capacidad alcanzaba para concedérselo todo: el
endpoint de edición acepta los flags `puede_*` y su queryset incluye la
propia membresía del solicitante, así que bastaba un PATCH sobre uno mismo.
"""

import pytest
from rest_framework.test import APIClient

from apps.negocios import services as negocios_services

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"


@pytest.fixture
def gestor_de_equipo(negocio_con_dueno):
    """Alguien que puede gestionar el equipo y nada más."""
    negocio, _dueno, _membresia = negocio_con_dueno
    _usuario, membresia = negocios_services.agregar_empleado(
        negocio=negocio,
        email="gestor@test.com",
        password=PASSWORD,
        nombre="Gestor",
        capacidades={"puede_gestionar_empleados": True},
    )
    client = APIClient()
    respuesta = client.post(
        "/api/auth/login/", {"email": "gestor@test.com", "password": PASSWORD}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
    return client, membresia


def test_no_puede_concederse_capacidades_a_si_mismo(gestor_de_equipo):
    """El agujero original: PATCH sobre la propia membresía."""
    client, membresia = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia.id}/",
        {"puede_editar_precios": True},
        format="json",
    )

    assert respuesta.status_code == 400
    membresia.refresh_from_db()
    assert membresia.puede_editar_precios is False


def test_no_puede_conceder_a_otro_una_capacidad_que_no_tiene(gestor_de_equipo, negocio_con_dueno):
    """Si no, la regla anterior se esquiva en dos pasos con un cómplice."""
    negocio, _dueno, _membresia = negocio_con_dueno
    client, _gestor = gestor_de_equipo
    _usuario, companero = negocios_services.agregar_empleado(
        negocio=negocio, email="companero@test.com", password=PASSWORD, nombre="Companero"
    )

    respuesta = client.patch(
        f"/api/negocios/empleados/{companero.id}/",
        {"puede_editar_precios": True},
        format="json",
    )

    assert respuesta.status_code == 400
    companero.refresh_from_db()
    assert companero.puede_editar_precios is False


def test_no_puede_dar_de_alta_a_alguien_con_mas_capacidades_que_uno(gestor_de_equipo):
    """Mismo hueco por la puerta de creación en vez de la de edición."""
    client, _gestor = gestor_de_equipo

    respuesta = client.post(
        "/api/negocios/empleados/",
        {
            "email": "nuevo@test.com",
            "nombre": "Nuevo",
            "password": PASSWORD,
            "puede_editar_precios": True,
        },
        format="json",
    )

    assert respuesta.status_code == 400


def test_si_puede_conceder_una_capacidad_que_si_tiene(gestor_de_equipo, negocio_con_dueno):
    """La regla acota, no bloquea: delegar lo propio sigue siendo válido."""
    negocio, _dueno, _membresia = negocio_con_dueno
    client, _gestor = gestor_de_equipo
    _usuario, companero = negocios_services.agregar_empleado(
        negocio=negocio, email="companero@test.com", password=PASSWORD, nombre="Companero"
    )

    respuesta = client.patch(
        f"/api/negocios/empleados/{companero.id}/",
        {"puede_gestionar_empleados": True},
        format="json",
    )

    assert respuesta.status_code == 200
    companero.refresh_from_db()
    assert companero.puede_gestionar_empleados is True


def test_si_puede_quitar_una_capacidad_que_no_tiene(gestor_de_equipo, negocio_con_dueno):
    """Reducir permisos ajenos no amplía los propios.

    Bloquearlo dejaría a un administrador sin poder frenar a alguien con
    más capacidades que él, que es justo cuando más falta hace.
    """
    negocio, _dueno, _membresia = negocio_con_dueno
    client, _gestor = gestor_de_equipo
    _usuario, companero = negocios_services.agregar_empleado(
        negocio=negocio,
        email="companero@test.com",
        password=PASSWORD,
        nombre="Companero",
        capacidades={"puede_editar_precios": True},
    )

    respuesta = client.patch(
        f"/api/negocios/empleados/{companero.id}/",
        {"puede_editar_precios": False},
        format="json",
    )

    assert respuesta.status_code == 200
    companero.refresh_from_db()
    assert companero.puede_editar_precios is False


def test_si_puede_editar_su_propia_especialidad(gestor_de_equipo):
    """La regla es sobre capacidades, no sobre el propio perfil."""
    client, membresia = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia.id}/",
        {"especialidad": "Barbero senior"},
        format="json",
    )

    assert respuesta.status_code == 200
    membresia.refresh_from_db()
    assert membresia.especialidad == "Barbero senior"


def test_reenviar_una_capacidad_propia_sin_cambiarla_no_rebota(gestor_de_equipo):
    """Solo los cambios reales cuentan: un PATCH idempotente no es un
    intento de auto-ascenso."""
    client, membresia = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia.id}/",
        {"puede_gestionar_empleados": True},
        format="json",
    )

    assert respuesta.status_code == 200


def test_el_dueno_puede_repartir_todo_porque_lo_tiene_todo(
    cliente_autenticado_dueno, negocio_con_dueno
):
    negocio, _dueno, _membresia = negocio_con_dueno
    _usuario, companero = negocios_services.agregar_empleado(
        negocio=negocio, email="companero@test.com", password=PASSWORD, nombre="Companero"
    )

    respuesta = cliente_autenticado_dueno.patch(
        f"/api/negocios/empleados/{companero.id}/",
        {"puede_editar_precios": True, "puede_configurar_horarios": True},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data
    companero.refresh_from_db()
    assert companero.puede_editar_precios is True
    assert companero.puede_configurar_horarios is True
