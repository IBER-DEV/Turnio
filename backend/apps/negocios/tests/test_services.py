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
        assert membresia.tiene(campo) is True


def test_agregar_empleado_toma_las_capacidades_de_su_cargo():
    negocio, _dueno, _membresia_dueno = services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
    )
    cargo = services.crear_cargo(
        negocio=negocio, nombre="Cajero", tipo="operativo", capacidades=["puede_cobrar"]
    )

    _usuario, membresia = services.agregar_empleado(
        negocio=negocio,
        email="empleado@ejemplo.com",
        password="otraClaveSegura123",
        nombre="Empleado Uno",
        cargo=cargo,
    )

    assert membresia.tenant_id == negocio.tenant_id
    assert membresia.tiene("puede_cobrar") is True
    assert membresia.tiene("puede_gestionar_empleados") is False
    assert membresia.tiene("puede_ver_reportes") is False


def test_editar_un_cargo_cambia_a_todos_los_que_lo_ocupan():
    """La contrapartida de que el cargo sea la única fuente de verdad, y
    la razón por la que la UI avisa a cuánta gente afecta."""
    negocio, _dueno, _membresia_dueno = services.registrar_negocio(
        nombre_negocio="Barbería El Corte",
        email_dueno="dueno@ejemplo.com",
        password_dueno="claveSegura123",
        nombre_dueno="Carlos Dueño",
    )
    cargo = services.crear_cargo(
        negocio=negocio, nombre="Cajero", tipo="operativo", capacidades=[]
    )
    membresias = [
        services.agregar_empleado(
            negocio=negocio,
            email=f"empleado{indice}@ejemplo.com",
            password="otraClaveSegura123",
            nombre=f"Empleado {indice}",
            cargo=cargo,
        )[1]
        for indice in range(3)
    ]
    assert not any(membresia.tiene("puede_cobrar") for membresia in membresias)

    cargo.puede_cobrar = True
    cargo.save(update_fields=["puede_cobrar"])

    for membresia in membresias:
        membresia.refresh_from_db()
        assert membresia.tiene("puede_cobrar") is True


def test_agregar_empleado_sin_cargo_entra_al_operativo_mas_acotado():
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

    assert membresia.cargo is not None
    for campo in services.CAMPOS_CAPACIDADES:
        assert membresia.tiene(campo) is False
