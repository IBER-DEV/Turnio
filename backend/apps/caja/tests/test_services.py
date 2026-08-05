import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.caja import services
from apps.caja.models import Caja, MovimientoCaja, RegistroAuditoria
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db


@pytest.fixture
def negocio_con_barbero_y_cobrador(negocio_con_dueno, servicio_de_prueba, empleado_con):
    """Dueño (tiene todas las capacidades, incluida `puede_cobrar`), un
    barbero sin capacidades especiales, y un segundo empleado que valida
    servicios — necesario porque nadie aprueba lo suyo."""
    negocio, dueno, membresia_dueno = negocio_con_dueno
    # `servicio_de_prueba` se crea con `precio="20000"` (string): Django no
    # convierte el valor asignado en `.objects.create()` a `Decimal` hasta
    # que se relee de la base. En la API real siempre llega un `Decimal`
    # ya validado por DRF — este refresh solo iguala el fixture a ese caso.
    servicio_de_prueba.refresh_from_db()
    barbero, _client_barbero = empleado_con(negocio=negocio, email="barbero@caja.test", nombre="Barbero")
    validador, _client_validador = empleado_con(
        negocio=negocio,
        email="validador@caja.test",
        nombre="Validador",
        capacidades=["puede_aprobar_servicios"],
    )
    return {
        "negocio": negocio,
        "dueno": membresia_dueno,
        "servicio": servicio_de_prueba,
        "barbero": barbero,
        "validador": validador,
    }


def _registro_aprobado(ctx):
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"],
        empleado=ctx["barbero"],
        servicio=ctx["servicio"],
        nombre_cliente="Cliente",
        fecha_hora=timezone.now() - datetime.timedelta(hours=1),
    )
    return servicios_services.aprobar_registro(registro=registro, revisor=ctx["validador"])


# --- abrir_caja ---


def test_abrir_caja_crea_caja_abierta(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador

    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    assert caja.estado == Caja.Estado.ABIERTA
    assert caja.abierta_por == ctx["dueno"]
    assert caja.saldo_inicial == Decimal("0")


def test_abrir_caja_acepta_saldo_inicial(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador

    caja = services.abrir_caja(
        negocio=ctx["negocio"], responsable=ctx["dueno"], saldo_inicial=Decimal("50000")
    )

    assert caja.saldo_inicial == Decimal("50000")


def test_abrir_caja_rechaza_si_ya_hay_una_abierta(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    with pytest.raises(services.YaHayCajaAbierta):
        services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])


def test_abrir_caja_deja_registro_de_auditoria(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador

    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    auditoria = RegistroAuditoria.objects.get(accion="caja.abrir")
    assert auditoria.negocio == ctx["negocio"]
    assert auditoria.actor == ctx["dueno"]
    assert auditoria.detalle["caja_id"] == caja.id


# --- registrar_movimiento ---


def test_registrar_movimiento_ingreso_simple(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    movimiento = services.registrar_movimiento(
        caja=caja,
        registrado_por=ctx["dueno"],
        tipo=MovimientoCaja.Tipo.INGRESO,
        monto=Decimal("20000"),
        concepto="Corte de cabello",
        metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
    )

    assert movimiento.caja == caja
    assert movimiento.monto_comision is None
    assert movimiento.empleado_comision is None


def test_registrar_movimiento_rechaza_sobre_caja_cerrada(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.cerrar_caja(caja=caja, responsable=ctx["dueno"])

    with pytest.raises(services.NoHayCajaAbierta):
        services.registrar_movimiento(
            caja=caja,
            registrado_por=ctx["dueno"],
            tipo=MovimientoCaja.Tipo.INGRESO,
            monto=Decimal("1000"),
            concepto="x",
            metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
        )


def test_registrar_movimiento_calcula_comision_desde_registro_servicio_aprobado(
    negocio_con_barbero_y_cobrador,
):
    ctx = negocio_con_barbero_y_cobrador
    ctx["servicio"].porcentaje_comision = Decimal("70")
    ctx["servicio"].save(update_fields=["porcentaje_comision"])
    registro = _registro_aprobado(ctx)
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    movimiento = services.registrar_movimiento(
        caja=caja,
        registrado_por=ctx["dueno"],
        tipo=MovimientoCaja.Tipo.INGRESO,
        monto=ctx["servicio"].precio,
        concepto=ctx["servicio"].nombre,
        metodo_pago=MovimientoCaja.MetodoPago.NEQUI,
        registro_servicio=registro,
    )

    esperado = (ctx["servicio"].precio * Decimal("70") / Decimal("100")).quantize(Decimal("0.01"))
    assert movimiento.monto_comision == esperado
    assert movimiento.empleado_comision == ctx["barbero"]


def test_registrar_movimiento_ignora_empleado_comision_manual_si_hay_registro(
    negocio_con_barbero_y_cobrador,
):
    """El vínculo con un `RegistroServicio` sobreescribe cualquier
    `empleado_comision` que se haya mandado — nadie se asigna la
    comisión del trabajo de otro."""
    ctx = negocio_con_barbero_y_cobrador
    registro = _registro_aprobado(ctx)
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    movimiento = services.registrar_movimiento(
        caja=caja,
        registrado_por=ctx["dueno"],
        tipo=MovimientoCaja.Tipo.INGRESO,
        monto=ctx["servicio"].precio,
        concepto=ctx["servicio"].nombre,
        metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
        registro_servicio=registro,
        empleado_comision=ctx["validador"],  # intento de asignársela a otro
    )

    assert movimiento.empleado_comision == ctx["barbero"]


def test_registrar_movimiento_rechaza_registro_no_aprobado(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    registro_pendiente = servicios_services.registrar_servicio(
        negocio=ctx["negocio"],
        empleado=ctx["barbero"],
        servicio=ctx["servicio"],
        nombre_cliente="Cliente",
        fecha_hora=timezone.now() - datetime.timedelta(hours=1),
    )
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    with pytest.raises(services.RegistroServicioNoAprobado):
        services.registrar_movimiento(
            caja=caja,
            registrado_por=ctx["dueno"],
            tipo=MovimientoCaja.Tipo.INGRESO,
            monto=Decimal("20000"),
            concepto="x",
            metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
            registro_servicio=registro_pendiente,
        )


def test_registrar_movimiento_rechaza_registro_ya_vinculado(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    registro = _registro_aprobado(ctx)
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.registrar_movimiento(
        caja=caja,
        registrado_por=ctx["dueno"],
        tipo=MovimientoCaja.Tipo.INGRESO,
        monto=ctx["servicio"].precio,
        concepto="x",
        metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
        registro_servicio=registro,
    )

    with pytest.raises(services.RegistroServicioYaVinculado):
        services.registrar_movimiento(
            caja=caja,
            registrado_por=ctx["dueno"],
            tipo=MovimientoCaja.Tipo.INGRESO,
            monto=ctx["servicio"].precio,
            concepto="duplicado",
            metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
            registro_servicio=registro,
        )


def test_registrar_movimiento_deja_registro_de_auditoria(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    movimiento = services.registrar_movimiento(
        caja=caja,
        registrado_por=ctx["dueno"],
        tipo=MovimientoCaja.Tipo.EGRESO,
        monto=Decimal("5000"),
        concepto="Insumos",
    )

    auditoria = RegistroAuditoria.objects.get(accion="caja.movimiento.crear")
    assert auditoria.detalle["movimiento_id"] == movimiento.id


# --- cerrar_caja ---


def test_cerrar_caja_marca_cerrada_y_guarda_quien_y_cuando(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    cerrada = services.cerrar_caja(caja=caja, responsable=ctx["dueno"], nota_cierre="Todo cuadró.")

    assert cerrada.estado == Caja.Estado.CERRADA
    assert cerrada.cerrada_por == ctx["dueno"]
    assert cerrada.cerrada_en is not None
    assert cerrada.nota_cierre == "Todo cuadró."


def test_cerrar_caja_dos_veces_falla(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.cerrar_caja(caja=caja, responsable=ctx["dueno"])

    with pytest.raises(services.NoHayCajaAbierta):
        services.cerrar_caja(caja=caja, responsable=ctx["dueno"])


def test_cerrar_caja_deja_registro_de_auditoria(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    services.cerrar_caja(caja=caja, responsable=ctx["dueno"])

    assert RegistroAuditoria.objects.filter(accion="caja.cerrar").exists()


# --- resumen_de ---


def test_resumen_de_calcula_totales_ingresos_egresos_neto(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.registrar_movimiento(
        caja=caja, registrado_por=ctx["dueno"], tipo=MovimientoCaja.Tipo.INGRESO,
        monto=Decimal("30000"), concepto="Corte", metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
    )
    services.registrar_movimiento(
        caja=caja, registrado_por=ctx["dueno"], tipo=MovimientoCaja.Tipo.EGRESO,
        monto=Decimal("5000"), concepto="Insumos",
    )

    resumen = services.resumen_de(caja)

    assert resumen["total_ingresos"] == Decimal("30000")
    assert resumen["total_egresos"] == Decimal("5000")
    assert resumen["neto"] == Decimal("25000")


def test_resumen_de_agrupa_por_metodo_de_pago(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.registrar_movimiento(
        caja=caja, registrado_por=ctx["dueno"], tipo=MovimientoCaja.Tipo.INGRESO,
        monto=Decimal("20000"), concepto="a", metodo_pago=MovimientoCaja.MetodoPago.NEQUI,
    )
    services.registrar_movimiento(
        caja=caja, registrado_por=ctx["dueno"], tipo=MovimientoCaja.Tipo.INGRESO,
        monto=Decimal("10000"), concepto="b", metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO,
    )

    resumen = services.resumen_de(caja)

    assert resumen["por_metodo_pago"] == {"nequi": Decimal("20000"), "efectivo": Decimal("10000")}


def test_resumen_de_agrupa_comisiones_por_empleado(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    ctx["servicio"].porcentaje_comision = Decimal("50")
    ctx["servicio"].save(update_fields=["porcentaje_comision"])
    registro = _registro_aprobado(ctx)
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.registrar_movimiento(
        caja=caja, registrado_por=ctx["dueno"], tipo=MovimientoCaja.Tipo.INGRESO,
        monto=ctx["servicio"].precio, concepto="Corte",
        metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO, registro_servicio=registro,
    )

    resumen = services.resumen_de(caja)

    assert len(resumen["comisiones_por_empleado"]) == 1
    fila = resumen["comisiones_por_empleado"][0]
    assert fila["empleado"] == ctx["barbero"].id
    assert fila["monto"] == (ctx["servicio"].precio * Decimal("50") / Decimal("100")).quantize(
        Decimal("0.01")
    )


def test_resumen_de_cuenta_servicios_aprobados_sin_cobrar(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    _registro_sin_cobrar = _registro_aprobado(ctx)
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    resumen = services.resumen_de(caja)

    assert resumen["servicios_aprobados_sin_cobrar"] == 1


def test_resumen_de_no_cuenta_servicios_ya_cobrados(negocio_con_barbero_y_cobrador):
    ctx = negocio_con_barbero_y_cobrador
    registro = _registro_aprobado(ctx)
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    services.registrar_movimiento(
        caja=caja, registrado_por=ctx["dueno"], tipo=MovimientoCaja.Tipo.INGRESO,
        monto=ctx["servicio"].precio, concepto="Corte",
        metodo_pago=MovimientoCaja.MetodoPago.EFECTIVO, registro_servicio=registro,
    )

    resumen = services.resumen_de(caja)

    assert resumen["servicios_aprobados_sin_cobrar"] == 0
