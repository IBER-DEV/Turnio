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
    )

    client = APIClient()
    _login(client, "empleado@ejemplo.com", "claveSegura123")

    respuesta = client.post(
        "/api/negocios/empleados/",
        {"email": "nuevo@ejemplo.com", "nombre": "Nuevo", "password": "claveSegura123"},
        format="json",
    )

    assert respuesta.status_code == 403


def test_dueno_puede_cambiarle_el_cargo_a_un_empleado():
    """Ya no se editan capacidades por persona: se le cambia el cargo."""
    negocio, _dueno, _m = services.registrar_negocio(
        nombre_negocio="Negocio A",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Dueño A",
    )
    _usuario, membresia = services.agregar_empleado(
        negocio=negocio,
        email="empleado@ejemplo.com",
        password="claveSegura123",
        nombre="Empleado",
    )
    recepcion = negocio.cargos.get(nombre="Recepción")

    client = APIClient()
    _login(client, "dueno@ejemplo.com", "claveSegura123")

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia.id}/",
        {"cargo": recepcion.id, "especialidad": "Barbero"},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data["cargo"] == recepcion.id
    assert respuesta.data["cargo_detalle"]["puede_cobrar"] is True
    assert respuesta.data["especialidad"] == "Barbero"
    membresia.refresh_from_db()
    assert membresia.tiene("puede_cobrar") is True


def test_no_se_puede_ver_detalle_de_empleado_de_otro_tenant():
    negocio_a, _dueno_a, _m = services.registrar_negocio(
        nombre_negocio="Negocio A",
        email_dueno="duenoa2@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Dueño A",
    )
    negocio_b, _dueno_b, _m2 = services.registrar_negocio(
        nombre_negocio="Negocio B",
        email_dueno="duenob2@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Dueño B",
    )
    _usuario_b, membresia_b = services.agregar_empleado(
        negocio=negocio_b, email="empleadob2@ejemplo.com", password="x", nombre="Empleado B"
    )

    client = APIClient()
    _login(client, "duenoa2@ejemplo.com", "claveSegura123")

    respuesta = client.get(f"/api/negocios/empleados/{membresia_b.id}/")

    assert respuesta.status_code == 404


def test_mi_membresia_devuelve_tipo_cargo_y_negocio():
    negocio, _dueno, _m = services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno3@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
        ciudad="Bogotá",
    )
    recepcion = negocio.cargos.get(nombre="Recepción")
    services.agregar_empleado(
        negocio=negocio,
        email="ana3@ejemplo.com",
        password="claveSegura123",
        nombre="Ana",
        especialidad="Barbera",
        cargo=recepcion,
    )

    client = APIClient()
    _login(client, "ana3@ejemplo.com", "claveSegura123")

    respuesta = client.get("/api/negocios/mi-membresia/")

    assert respuesta.status_code == 200
    assert respuesta.data["email"] == "ana3@ejemplo.com"
    assert respuesta.data["especialidad"] == "Barbera"
    # El discriminador de dominio con que el frontend monta el shell...
    assert respuesta.data["tipo"] == "recepcion"
    # ...y las capacidades con que gatea cada acción dentro de él.
    assert respuesta.data["cargo"]["nombre"] == "Recepción"
    assert respuesta.data["cargo"]["puede_gestionar_agenda"] is True
    assert respuesta.data["cargo"]["puede_editar_precios"] is False
    assert respuesta.data["negocio"]["nombre"] == "Barbería El Corte"
    assert respuesta.data["negocio"]["ciudad"] == "Bogotá"


def test_mi_membresia_requiere_autenticacion():
    client = APIClient()

    respuesta = client.get("/api/negocios/mi-membresia/")

    assert respuesta.status_code == 401


# --- Separación entre /equipo/ (directorio) y /empleados/ (gestión) ---


def _cliente_empleado_sin_gestion(negocio):
    """Empleado que puede gestionar la agenda pero NO el equipo: el caso
    real de un barbero que necesita ver el calendario de todos."""
    from rest_framework.test import APIClient

    services.agregar_empleado(
        negocio=negocio,
        email="barbero@test.com",
        password="claveSegura123",
        nombre="Barbero Sin Gestión",
        especialidad="Fade",
        cargo=negocio.cargos.get(nombre="Recepción"),
    )
    client = APIClient()
    login = client.post(
        "/api/auth/login/",
        {"email": "barbero@test.com", "password": "claveSegura123"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    return client


def test_listar_empleados_ahora_exige_gestionar_equipo(negocio_con_dueno):
    """Antes cualquier miembro podía listar y veía email + capacidades
    de todos sus compañeros."""
    negocio, _dueno, _membresia = negocio_con_dueno
    client = _cliente_empleado_sin_gestion(negocio)

    respuesta = client.get("/api/negocios/empleados/")

    assert respuesta.status_code == 403


def test_detalle_de_empleado_tambien_exige_gestionar_equipo(negocio_con_dueno):
    negocio, _dueno, membresia = negocio_con_dueno
    client = _cliente_empleado_sin_gestion(negocio)

    respuesta = client.get(f"/api/negocios/empleados/{membresia.id}/")

    assert respuesta.status_code == 403


def test_equipo_lo_puede_ver_cualquier_miembro(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    client = _cliente_empleado_sin_gestion(negocio)

    respuesta = client.get("/api/negocios/equipo/")

    assert respuesta.status_code == 200
    assert len(respuesta.data) == 2


def test_equipo_no_expone_email_ni_capacidades(negocio_con_dueno):
    """El punto de la separación: la agenda necesita nombres, no datos
    personales ni la matriz de permisos de cada compañero."""
    negocio, _dueno, _membresia = negocio_con_dueno
    client = _cliente_empleado_sin_gestion(negocio)

    respuesta = client.get("/api/negocios/equipo/")

    for miembro in respuesta.data:
        assert set(miembro.keys()) == {"id", "nombre", "especialidad", "activo"}


def test_equipo_no_expone_miembros_de_otro_negocio(cliente_autenticado_dueno):
    services.registrar_negocio(
        nombre_negocio="Barbería Ajena",
        email_dueno="ajeno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Ajeno",
    )

    respuesta = cliente_autenticado_dueno.get("/api/negocios/equipo/")

    nombres = {miembro["nombre"] for miembro in respuesta.data}
    assert "Ajeno" not in nombres
