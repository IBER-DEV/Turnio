"""Que `puede_gestionar_empleados` no sea una escalada de privilegios.

Con las capacidades en `Cargo` hay **dos puertas** en vez de una: editar
el cargo que uno ocupa, y mudarse a un cargo con más capacidades. Las dos
tienen que estar cerradas, o cerrar una sola no sirve de nada.
"""

import pytest

from apps.negocios import services as negocios_services
from apps.usuarios.models import Cargo

pytestmark = pytest.mark.django_db


@pytest.fixture
def gestor_de_equipo(negocio_con_dueno, empleado_con):
    """Alguien que puede gestionar el equipo y nada más."""
    negocio, _dueno, _membresia = negocio_con_dueno
    return empleado_con(
        negocio=negocio,
        email="gestor@test.com",
        nombre="Gestor",
        capacidades=["puede_gestionar_empleados"],
    )


@pytest.fixture
def companero(negocio_con_dueno, empleado_con):
    negocio, _dueno, _membresia = negocio_con_dueno
    return empleado_con(negocio=negocio, email="companero@test.com", nombre="Companero")


# --- Puerta 1: editar el cargo propio ---


def test_no_puede_ampliar_el_cargo_que_el_mismo_ocupa(gestor_de_equipo):
    membresia, client = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/cargos/{membresia.cargo_id}/",
        {"puede_editar_precios": True},
        format="json",
    )

    assert respuesta.status_code == 400
    membresia.cargo.refresh_from_db()
    assert membresia.cargo.puede_editar_precios is False


def test_si_puede_recortar_o_renombrar_su_propio_cargo(gestor_de_equipo):
    """La regla es contra ampliarse, no contra tocar el cargo propio."""
    membresia, client = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/cargos/{membresia.cargo_id}/",
        {"nombre": "Coordinación"},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data
    membresia.cargo.refresh_from_db()
    assert membresia.cargo.nombre == "Coordinación"


# --- Puerta 2: mudarse a un cargo mejor ---


def test_no_puede_cambiarse_el_cargo_a_si_mismo(gestor_de_equipo, negocio_con_dueno):
    """Aunque no toque ningún permiso: mudarse al cargo del dueño es la
    misma escalada por la puerta de al lado."""
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    membresia, client = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia.id}/",
        {"cargo": membresia_dueno.cargo_id},
        format="json",
    )

    assert respuesta.status_code == 400
    membresia.refresh_from_db()
    assert membresia.cargo_id != membresia_dueno.cargo_id


def test_no_puede_poner_a_otro_en_un_cargo_con_mas_de_lo_que_uno_tiene(
    gestor_de_equipo, companero, negocio_con_dueno
):
    """Si no, se le da el cargo bueno a un cómplice y que él lo ascienda."""
    _negocio, _dueno, membresia_dueno = negocio_con_dueno
    _gestor, client = gestor_de_equipo
    membresia_companero, _client_companero = companero

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia_companero.id}/",
        {"cargo": membresia_dueno.cargo_id},
        format="json",
    )

    assert respuesta.status_code == 400
    membresia_companero.refresh_from_db()
    assert membresia_companero.cargo_id != membresia_dueno.cargo_id


def test_no_puede_crear_un_cargo_con_capacidades_que_no_tiene(gestor_de_equipo):
    _membresia, client = gestor_de_equipo

    respuesta = client.post(
        "/api/negocios/cargos/",
        {"nombre": "Todopoderoso", "tipo": "administracion", "puede_editar_precios": True},
        format="json",
    )

    assert respuesta.status_code == 400


def test_no_puede_dar_de_alta_a_alguien_en_un_cargo_que_lo_supera(
    gestor_de_equipo, negocio_con_dueno
):
    _negocio, _dueno, membresia_dueno = negocio_con_dueno
    _membresia, client = gestor_de_equipo

    respuesta = client.post(
        "/api/negocios/empleados/",
        {
            "email": "nuevo@test.com",
            "nombre": "Nuevo",
            "password": "claveSegura123",
            "cargo": membresia_dueno.cargo_id,
        },
        format="json",
    )

    assert respuesta.status_code == 400


# --- Lo que sí debe seguir funcionando ---


def test_si_puede_crear_un_cargo_con_lo_que_el_tiene(gestor_de_equipo):
    _membresia, client = gestor_de_equipo

    respuesta = client.post(
        "/api/negocios/cargos/",
        {"nombre": "Asistente de equipo", "tipo": "operativo", "puede_gestionar_empleados": True},
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data


def test_si_puede_crear_un_cargo_mas_acotado_y_asignarlo(gestor_de_equipo, companero):
    _membresia, client = gestor_de_equipo
    membresia_companero, _c = companero

    cargo = client.post(
        "/api/negocios/cargos/",
        {"nombre": "Ayudante", "tipo": "operativo"},
        format="json",
    )
    assert cargo.status_code == 201, cargo.data

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia_companero.id}/",
        {"cargo": cargo.data["id"]},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data


def test_si_puede_recortar_un_cargo_ajeno_con_capacidades_que_el_no_tiene(
    gestor_de_equipo, negocio_con_dueno
):
    """Reducir permisos ajenos no amplía los propios. Bloquearlo dejaría a
    un administrador sin poder frenar a alguien con más que él."""
    negocio, _dueno, _membresia = negocio_con_dueno
    _gestor, client = gestor_de_equipo
    cargo_ajeno = negocios_services.crear_cargo(
        negocio=negocio,
        nombre="Con precios",
        tipo=Cargo.Tipo.OPERATIVO,
        capacidades=["puede_editar_precios"],
    )

    respuesta = client.patch(
        f"/api/negocios/cargos/{cargo_ajeno.id}/",
        {"puede_editar_precios": False},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data
    cargo_ajeno.refresh_from_db()
    assert cargo_ajeno.puede_editar_precios is False


def test_si_puede_editar_su_propia_especialidad(gestor_de_equipo):
    """La restricción es sobre capacidades, no sobre el propio perfil."""
    membresia, client = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/empleados/{membresia.id}/",
        {"especialidad": "Barbero senior"},
        format="json",
    )

    assert respuesta.status_code == 200
    membresia.refresh_from_db()
    assert membresia.especialidad == "Barbero senior"


def test_reenviar_una_capacidad_sin_cambiarla_no_rebota(gestor_de_equipo):
    """Un PATCH idempotente no es un intento de auto-ascenso."""
    membresia, client = gestor_de_equipo

    respuesta = client.patch(
        f"/api/negocios/cargos/{membresia.cargo_id}/",
        {"puede_gestionar_empleados": True},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data


def test_el_dueno_puede_repartir_todo_porque_lo_tiene_todo(
    cliente_autenticado_dueno, negocio_con_dueno
):
    negocio, _dueno, _membresia = negocio_con_dueno

    respuesta = cliente_autenticado_dueno.post(
        "/api/negocios/cargos/",
        {
            "nombre": "Encargado",
            "tipo": "administracion",
            "puede_editar_precios": True,
            "puede_configurar_horarios": True,
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert negocio.cargos.get(nombre="Encargado").puede_editar_precios is True


# --- Aislamiento y borrado ---


def test_no_se_ven_ni_se_tocan_cargos_de_otro_negocio(cliente_autenticado_dueno):
    otro_negocio, _otro_dueno, _otra = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Ajena",
        email_dueno="ajeno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Ajeno",
    )
    cargo_ajeno = otro_negocio.cargos.first()

    listado = cliente_autenticado_dueno.get("/api/negocios/cargos/")
    detalle = cliente_autenticado_dueno.get(f"/api/negocios/cargos/{cargo_ajeno.id}/")

    assert {cargo["id"] for cargo in listado.data}.isdisjoint({cargo_ajeno.id})
    assert detalle.status_code == 404


def test_no_se_borra_un_cargo_que_alguien_ocupa(cliente_autenticado_dueno, negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    respuesta = cliente_autenticado_dueno.delete(f"/api/negocios/cargos/{membresia.cargo_id}/")

    assert respuesta.status_code == 400
    assert Cargo.objects.filter(pk=membresia.cargo_id).exists()


def test_si_se_borra_un_cargo_vacio(cliente_autenticado_dueno, negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    vacio = negocios_services.crear_cargo(
        negocio=negocio, nombre="Sin gente", tipo=Cargo.Tipo.OPERATIVO, capacidades=[]
    )

    respuesta = cliente_autenticado_dueno.delete(f"/api/negocios/cargos/{vacio.id}/")

    assert respuesta.status_code == 204
    assert not Cargo.objects.filter(pk=vacio.id).exists()


def test_no_se_repite_el_nombre_de_cargo_dentro_del_negocio(cliente_autenticado_dueno):
    respuesta = cliente_autenticado_dueno.post(
        "/api/negocios/cargos/", {"nombre": "Recepción", "tipo": "recepcion"}, format="json"
    )

    assert respuesta.status_code == 400


def test_leer_cargos_no_exige_gestionar_equipo(negocio_con_dueno, empleado_con):
    """La UI necesita mostrar en qué cargo está cada quien."""
    negocio, _dueno, _membresia = negocio_con_dueno
    _raso, client = empleado_con(negocio=negocio, email="raso@test.com", nombre="Raso")

    respuesta = client.get("/api/negocios/cargos/")

    assert respuesta.status_code == 200
    assert len(respuesta.data) >= len(negocios_services.CARGOS_INICIALES)


def test_escribir_cargos_si_exige_gestionar_equipo(negocio_con_dueno, empleado_con):
    negocio, _dueno, _membresia = negocio_con_dueno
    _raso, client = empleado_con(negocio=negocio, email="raso@test.com", nombre="Raso")

    respuesta = client.post(
        "/api/negocios/cargos/", {"nombre": "Inventado", "tipo": "operativo"}, format="json"
    )

    assert respuesta.status_code == 403
