import pytest

from apps.negocios import services

pytestmark = pytest.mark.django_db


def test_registrar_negocio_otorga_todas_las_capacidades_al_dueno():
    negocio, dueno, membresia = services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
        ciudad="Bogotá",
    )

    assert negocio.tenant_id == membresia.tenant_id
    assert membresia.usuario_id == dueno.id
    for campo in services.CAMPOS_CAPACIDADES:
        assert getattr(membresia, campo) is True


def test_agregar_empleado_solo_otorga_las_capacidades_indicadas():
    negocio, _dueno, _membresia_dueno = services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
    )

    _usuario, membresia = services.agregar_empleado(
        negocio=negocio,
        email="empleado@ejemplo.com",
        password="otraClaveSegura123",
        nombre="Empleado Uno",
        capacidades={"puede_cobrar": True},
    )

    assert membresia.tenant_id == negocio.tenant_id
    assert membresia.puede_cobrar is True
    assert membresia.puede_gestionar_empleados is False
    assert membresia.puede_ver_reportes is False


def test_agregar_empleado_sin_capacidades_no_otorga_ninguna():
    negocio, _dueno, _membresia_dueno = services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
    )

    _usuario, membresia = services.agregar_empleado(
        negocio=negocio,
        email="empleado2@ejemplo.com",
        password="otraClaveSegura123",
        nombre="Empleado Dos",
    )

    for campo in services.CAMPOS_CAPACIDADES:
        assert getattr(membresia, campo) is False
