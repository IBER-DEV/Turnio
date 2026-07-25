from decimal import Decimal

import pytest

from apps.servicios import services

pytestmark = pytest.mark.django_db


def test_crear_servicio_queda_asociado_al_tenant_del_negocio(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno

    servicio = services.crear_servicio(
        negocio=negocio, nombre="Corte", precio="20000", duracion_minutos=30
    )

    assert servicio.tenant_id == negocio.tenant_id
    assert servicio.negocio_id == negocio.id


def test_calcular_comision_usa_el_porcentaje_del_servicio(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    servicio = services.crear_servicio(
        negocio=negocio,
        nombre="Corte",
        precio=Decimal("20000"),
        duracion_minutos=30,
        porcentaje_comision=Decimal("10"),
    )

    assert services.calcular_comision(servicio=servicio) == Decimal("2000.00")


def test_calcular_comision_permite_monto_distinto_al_precio_base(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    servicio = services.crear_servicio(
        negocio=negocio,
        nombre="Corte",
        precio=Decimal("20000"),
        duracion_minutos=30,
        porcentaje_comision=Decimal("10"),
    )

    assert services.calcular_comision(servicio=servicio, monto=Decimal("50000")) == Decimal("5000.00")


# --- Alta en lote ---


def test_crear_servicios_en_lote_crea_todos_con_el_tenant_correcto(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno

    creados = services.crear_servicios_en_lote(
        negocio=negocio,
        servicios=[
            {"nombre": "Corte", "precio": Decimal("25000"), "duracion_minutos": 30},
            {"nombre": "Barba", "precio": Decimal("15000"), "duracion_minutos": 20},
        ],
    )

    assert len(creados) == 2
    assert negocio.servicios.count() == 2
    assert all(servicio.tenant_id == negocio.tenant_id for servicio in negocio.servicios.all())
