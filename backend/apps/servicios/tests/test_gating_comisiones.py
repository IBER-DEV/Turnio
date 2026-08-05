"""Bloqueo #8 del ROADMAP.md: separar quién puede cambiar el precio de un
`Servicio` de quién puede cambiar su `porcentaje_comision`.
"""

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def negocio_y_servicio(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, _membresia = negocio_con_dueno
    return negocio, servicio_de_prueba


def test_editar_precio_requiere_puede_editar_precios(negocio_y_servicio, empleado_con):
    negocio, servicio = negocio_y_servicio
    _m, client = empleado_con(
        negocio=negocio,
        email="soloComision@test.com",
        capacidades=["puede_editar_comisiones"],
    )

    respuesta = client.patch(f"/api/servicios/{servicio.id}/", {"precio": "99999"}, format="json")

    assert respuesta.status_code == 400
    assert "precio" in respuesta.data


def test_editar_comision_requiere_puede_editar_comisiones(negocio_y_servicio, empleado_con):
    negocio, servicio = negocio_y_servicio
    _m, client = empleado_con(
        negocio=negocio,
        email="soloPrecio@test.com",
        capacidades=["puede_editar_precios"],
    )

    respuesta = client.patch(
        f"/api/servicios/{servicio.id}/", {"porcentaje_comision": "50"}, format="json"
    )

    assert respuesta.status_code == 400
    assert "porcentaje_comision" in respuesta.data


def test_puede_editar_precios_sin_comisiones_si_puede_tocar_el_precio(
    negocio_y_servicio, empleado_con
):
    negocio, servicio = negocio_y_servicio
    _m, client = empleado_con(
        negocio=negocio,
        email="soloPrecio2@test.com",
        capacidades=["puede_editar_precios"],
    )

    respuesta = client.patch(f"/api/servicios/{servicio.id}/", {"precio": "99999"}, format="json")

    assert respuesta.status_code == 200
    assert respuesta.data["precio"] == "99999.00"


def test_puede_editar_comisiones_sin_precios_si_puede_tocar_la_comision(
    negocio_y_servicio, empleado_con
):
    negocio, servicio = negocio_y_servicio
    _m, client = empleado_con(
        negocio=negocio,
        email="soloComision2@test.com",
        capacidades=["puede_editar_comisiones"],
    )

    respuesta = client.patch(
        f"/api/servicios/{servicio.id}/", {"porcentaje_comision": "50"}, format="json"
    )

    assert respuesta.status_code == 200
    assert respuesta.data["porcentaje_comision"] == "50.00"


def test_reenviar_el_mismo_precio_no_requiere_la_capacidad(negocio_y_servicio, empleado_con):
    """Mismo criterio que `CargoSerializer.validate()`: reenviar un valor
    que ya tenía no es un intento de cambiarlo."""
    negocio, servicio = negocio_y_servicio
    servicio.refresh_from_db()
    _m, client = empleado_con(
        negocio=negocio,
        email="soloComision3@test.com",
        capacidades=["puede_editar_comisiones"],
    )

    respuesta = client.patch(
        f"/api/servicios/{servicio.id}/",
        {"precio": str(servicio.precio), "porcentaje_comision": "10"},
        format="json",
    )

    assert respuesta.status_code == 200


def test_sin_ninguna_capacidad_no_puede_editar(negocio_y_servicio, empleado_con):
    negocio, servicio = negocio_y_servicio
    _m, client = empleado_con(negocio=negocio, email="raso@test.com", capacidades=[])

    respuesta = client.patch(f"/api/servicios/{servicio.id}/", {"precio": "1"}, format="json")

    assert respuesta.status_code == 403


def test_dueno_con_todas_las_capacidades_edita_ambos_campos(
    negocio_y_servicio, cliente_autenticado_dueno
):
    negocio, servicio = negocio_y_servicio

    respuesta = cliente_autenticado_dueno.patch(
        f"/api/servicios/{servicio.id}/",
        {"precio": "30000", "porcentaje_comision": "65"},
        format="json",
    )

    assert respuesta.status_code == 200
    assert respuesta.data["precio"] == "30000.00"
    assert respuesta.data["porcentaje_comision"] == "65.00"
