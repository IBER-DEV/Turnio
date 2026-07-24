import pytest
from rest_framework.test import APIClient

from apps.negocios import services

pytestmark = pytest.mark.django_db


def test_registro_negocio_crea_negocio_y_devuelve_tokens():
    client = APIClient()

    respuesta = client.post(
        "/api/negocios/registro/",
        {
            "nombre_negocio": "Barbería El Corte",
            "ciudad": "Bogotá",
            "email_dueno": "dueno@ejemplo.com",
            "nombre_dueno": "Carlos Dueño",
            "password_dueno": "claveSegura123",
            "empleados": [
                {
                    "email": "empleado@ejemplo.com",
                    "nombre": "Empleado Uno",
                    "password": "otraClaveSegura123",
                    "puede_cobrar": True,
                }
            ],
        },
        format="json",
    )

    assert respuesta.status_code == 201
    assert respuesta.data["negocio"]["nombre"] == "Barbería El Corte"
    assert "access" in respuesta.data
    assert "refresh" in respuesta.data


def test_registro_rechaza_email_de_dueno_duplicado():
    client = APIClient()
    services.registrar_negocio(
        nombre_negocio="Negocio Existente",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Ya Existe",
    )

    respuesta = client.post(
        "/api/negocios/registro/",
        {
            "nombre_negocio": "Otro Negocio",
            "email_dueno": "dueno@ejemplo.com",
            "nombre_dueno": "Otro",
            "password_dueno": "claveSegura123",
        },
        format="json",
    )

    assert respuesta.status_code == 400


def test_login_con_credenciales_devuelve_tokens():
    client = APIClient()
    services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
    )

    respuesta = client.post(
        "/api/auth/login/",
        {"email": "dueno@ejemplo.com", "password": "claveSegura123"},
        format="json",
    )

    assert respuesta.status_code == 200
    assert "access" in respuesta.data
    assert "refresh" in respuesta.data


def _login(client, email, password):
    respuesta = client.post(
        "/api/auth/login/", {"email": email, "password": password}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")


def test_lista_de_empleados_no_filtra_datos_de_otro_tenant():
    negocio_a, _dueno_a, _m = services.registrar_negocio(
        nombre_negocio="Negocio A",
        email_dueno="duenoa@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Dueño A",
    )
    services.agregar_empleado(
        negocio=negocio_a, email="empleadoa@ejemplo.com", password="x", nombre="Empleado A"
    )

    negocio_b, _dueno_b, _m2 = services.registrar_negocio(
        nombre_negocio="Negocio B",
        email_dueno="duenob@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Dueño B",
    )
    services.agregar_empleado(
        negocio=negocio_b, email="empleadob@ejemplo.com", password="x", nombre="Empleado B"
    )

    client = APIClient()
    _login(client, "duenoa@ejemplo.com", "claveSegura123")

    respuesta = client.get("/api/negocios/empleados/")

    assert respuesta.status_code == 200
    emails = {miembro["email"] for miembro in respuesta.data}
    assert emails == {"duenoa@ejemplo.com", "empleadoa@ejemplo.com"}


def test_empleado_sin_capacidad_no_puede_agregar_empleados():
    negocio, _dueno, _m = services.registrar_negocio(
        nombre_negocio="Negocio A",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Dueño A",
    )
    services.agregar_empleado(
        negocio=negocio,
        email="empleado@ejemplo.com",
        password="claveSegura123",
        nombre="Empleado Sin Permiso",
        capacidades={"puede_cobrar": True},
    )

    client = APIClient()
    _login(client, "empleado@ejemplo.com", "claveSegura123")

    respuesta = client.post(
        "/api/negocios/empleados/",
        {"email": "nuevo@ejemplo.com", "nombre": "Nuevo", "password": "claveSegura123"},
        format="json",
    )

    assert respuesta.status_code == 403
