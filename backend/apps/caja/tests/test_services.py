from decimal import Decimal

import pytest

from apps.caja import services
from apps.caja.models import (
    Caja,
    ComisionDevengada,
    MetodoPago,
    MovimientoCaja,
    RegistroAuditoria,
    Venta,
)
from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db


@pytest.fixture
def ctx(negocio_con_dueno, servicio_de_prueba, empleado_con):
    """Un negocio con dueño (todas las capacidades), un barbero y un
    servicio de $20.000 con 40% de comisión."""
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    # `servicio_de_prueba` se crea con `precio="20000"` (string): Django no
    # convierte el valor asignado en `.objects.create()` a `Decimal` hasta
    # que se relee de la base. En la API real siempre llega un `Decimal`
    # ya validado por DRF — este refresh solo iguala el fixture a ese caso.
    servicio_de_prueba.porcentaje_comision = Decimal("40")
    servicio_de_prueba.save()
    servicio_de_prueba.refresh_from_db()
    barbero, _client = empleado_con(negocio=negocio, email="barbero@caja.test", nombre="Barbero")
    return {
        "negocio": negocio,
        "dueno": membresia_dueno,
        "servicio": servicio_de_prueba,
        "barbero": barbero,
    }


def _venta(ctx, cantidad=1):
    return services.crear_venta(
        negocio=ctx["negocio"],
        creada_por=ctx["dueno"],
        nombre_cliente="Juan Pérez",
        items=[
            {"servicio": ctx["servicio"], "empleado": ctx["barbero"], "cantidad": cantidad}
        ],
    )


# --- abrir / cerrar caja ---


def test_abrir_caja_crea_caja_abierta(ctx):
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    assert caja.estado == Caja.Estado.ABIERTA
    assert RegistroAuditoria.objects.filter(accion="caja.abrir").exists()


def test_no_se_pueden_abrir_dos_cajas(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    with pytest.raises(services.YaHayCajaAbierta):
        services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])


def test_cerrar_caja_exige_contar_el_efectivo(ctx):
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    with pytest.raises(services.ArqueoRequerido):
        services.cerrar_caja(caja=caja, responsable=ctx["dueno"], efectivo_contado=None)


def test_arqueo_solo_cuenta_efectivo(ctx):
    """Un cobro por Nequi no estuvo nunca en el cajón: no puede inflar el
    esperado ni generar un faltante falso."""
    caja = services.abrir_caja(
        negocio=ctx["negocio"], responsable=ctx["dueno"], saldo_inicial=Decimal("100000")
    )
    venta_efectivo = _venta(ctx)
    services.registrar_pago(
        venta=venta_efectivo,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    venta_nequi = _venta(ctx)
    services.registrar_pago(
        venta=venta_nequi,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.NEQUI,
    )

    arqueo = services.arqueo_de(caja)

    assert arqueo["ingresos_efectivo"] == Decimal("20000")
    assert arqueo["efectivo_esperado"] == Decimal("120000")
    # Los $20.000 de Nequi sí existen, pero para conciliar aparte.
    assert services.resumen_de(caja)["total_ingresos"] == Decimal("40000")


def test_arqueo_resta_egresos_y_devoluciones_en_efectivo(ctx):
    """La fórmula completa: inicial + ingresos − egresos − devoluciones.

    Es el test que fija que una devolución **no** se cuente dos veces:
    tiene tipo propio y no es un egreso.
    """
    caja = services.abrir_caja(
        negocio=ctx["negocio"], responsable=ctx["dueno"], saldo_inicial=Decimal("100000")
    )
    venta = _venta(ctx)
    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    services.registrar_egreso(
        negocio=ctx["negocio"],
        registrado_por=ctx["dueno"],
        monto=Decimal("50000"),
        concepto="Compra de shampoo",
        categoria=MovimientoCaja.CategoriaEgreso.INSUMOS,
        metodo_pago=MetodoPago.EFECTIVO,
    )
    services.devolver(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("5000"),
        metodo_pago=MetodoPago.EFECTIVO,
        motivo="Cliente insatisfecho",
    )

    arqueo = services.arqueo_de(caja)

    assert arqueo["egresos_efectivo"] == Decimal("50000")
    assert arqueo["devoluciones_efectivo"] == Decimal("5000")
    assert arqueo["efectivo_esperado"] == Decimal("65000")


def test_cierre_congela_la_diferencia(ctx):
    caja = services.abrir_caja(
        negocio=ctx["negocio"], responsable=ctx["dueno"], saldo_inicial=Decimal("100000")
    )

    caja = services.cerrar_caja(
        caja=caja, responsable=ctx["dueno"], efectivo_contado=Decimal("98000")
    )

    assert caja.estado == Caja.Estado.CERRADA
    assert caja.efectivo_esperado == Decimal("100000")
    assert caja.diferencia == Decimal("-2000")


def test_un_faltante_no_bloquea_el_cierre(ctx):
    """Negarse a cerrar no hace desaparecer el faltante y sí deja al
    negocio sin poder operar mañana."""
    caja = services.abrir_caja(
        negocio=ctx["negocio"], responsable=ctx["dueno"], saldo_inicial=Decimal("100000")
    )

    caja = services.cerrar_caja(
        caja=caja, responsable=ctx["dueno"], efectivo_contado=Decimal("0")
    )

    assert caja.estado == Caja.Estado.CERRADA
    assert caja.diferencia == Decimal("-100000")


# --- ventas ---


def test_crear_venta_congela_precio_y_comision(ctx):
    venta = _venta(ctx)

    item = venta.items.get()
    assert venta.total == Decimal("20000")
    assert item.precio_unitario == Decimal("20000")
    assert item.porcentaje_comision == Decimal("40")

    # Cambiar el catálogo no reescribe la venta de ayer.
    ctx["servicio"].precio = Decimal("35000")
    ctx["servicio"].porcentaje_comision = Decimal("10")
    ctx["servicio"].save()
    venta.refresh_from_db()
    item.refresh_from_db()

    assert venta.total == Decimal("20000")
    assert item.precio_unitario == Decimal("20000")
    assert item.porcentaje_comision == Decimal("40")


def test_crear_venta_no_mueve_plata_ni_exige_caja_abierta(ctx):
    """El servicio genera la deuda; el pago genera el movimiento."""
    venta = _venta(ctx)

    assert venta.estado == Venta.Estado.PENDIENTE
    assert MovimientoCaja.objects.count() == 0


def test_venta_sin_items_no_existe(ctx):
    with pytest.raises(services.VentaSinItems):
        services.crear_venta(
            negocio=ctx["negocio"],
            creada_por=ctx["dueno"],
            nombre_cliente="Juan",
            items=[],
        )


def test_venta_con_item_de_otro_negocio_se_rechaza(ctx, empleado_con):
    """Última red del aislamiento multi-tenant, después de los querysets."""
    otro_negocio, _dueno, _membresia = negocios_services.registrar_negocio(
        nombre_negocio="Otra Barbería",
        email_dueno="otro@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Otro",
    )
    servicio_ajeno = servicios_services.crear_servicio(
        negocio=otro_negocio, nombre="Corte ajeno", precio="30000", duracion_minutos=30
    )

    with pytest.raises(services.RecursoDeOtroNegocio):
        services.crear_venta(
            negocio=ctx["negocio"],
            creada_por=ctx["dueno"],
            nombre_cliente="Juan",
            items=[{"servicio": servicio_ajeno, "empleado": ctx["barbero"]}],
        )


# --- cobro ---


def test_cobrar_exige_caja_abierta(ctx):
    venta = _venta(ctx)

    with pytest.raises(services.NoHayCajaAbierta):
        services.registrar_pago(
            venta=venta,
            registrado_por=ctx["dueno"],
            monto=Decimal("20000"),
            metodo_pago=MetodoPago.EFECTIVO,
        )


def test_cobro_completo_crea_movimiento_y_devenga_comision(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)

    pago = services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    venta.refresh_from_db()

    assert venta.estado == Venta.Estado.PAGADA
    assert pago.movimiento.tipo == MovimientoCaja.Tipo.INGRESO
    assert pago.movimiento.venta_id == venta.id

    comision = ComisionDevengada.objects.get()
    assert comision.empleado_id == ctx["barbero"].id
    assert comision.monto == Decimal("8000")  # 40% de 20.000


def test_pago_mixto_devenga_la_comision_una_sola_vez(ctx):
    """Con pagos parciales, la comisión es de la **venta**, no de cada
    pago: si se calculara por movimiento, este caso pagaría dos veces."""
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)

    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("8000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    venta.refresh_from_db()
    assert venta.estado == Venta.Estado.PARCIAL
    assert not ComisionDevengada.objects.exists()

    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("12000"),
        metodo_pago=MetodoPago.TARJETA,
    )
    venta.refresh_from_db()

    assert venta.estado == Venta.Estado.PAGADA
    assert venta.pagos.count() == 2
    assert ComisionDevengada.objects.count() == 1
    assert ComisionDevengada.objects.get().monto == Decimal("8000")


def test_no_se_puede_cobrar_de_mas(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)

    with pytest.raises(services.MontoExcedeSaldo):
        services.registrar_pago(
            venta=venta,
            registrado_por=ctx["dueno"],
            monto=Decimal("25000"),
            metodo_pago=MetodoPago.EFECTIVO,
        )


def test_no_se_puede_cobrar_dos_veces_la_misma_venta(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)
    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    venta.refresh_from_db()

    with pytest.raises(services.VentaNoCobrable):
        services.registrar_pago(
            venta=venta,
            registrado_por=ctx["dueno"],
            monto=Decimal("20000"),
            metodo_pago=MetodoPago.EFECTIVO,
        )


# --- devoluciones y anulación ---


def test_devolver_no_toca_el_movimiento_original(ctx):
    """La garantía de fondo: el historial financiero no se altera
    retroactivamente."""
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)
    pago = services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    movimiento_original = pago.movimiento

    services.devolver(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
        motivo="Quedó mal el corte",
    )

    movimiento_original.refresh_from_db()
    assert movimiento_original.monto == Decimal("20000")
    assert movimiento_original.tipo == MovimientoCaja.Tipo.INGRESO
    assert MovimientoCaja.objects.count() == 2
    assert MovimientoCaja.objects.filter(tipo=MovimientoCaja.Tipo.DEVOLUCION).count() == 1


def test_devolver_exige_motivo(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)
    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )

    with pytest.raises(services.MotivoRequerido):
        services.devolver(
            venta=venta,
            registrado_por=ctx["dueno"],
            monto=Decimal("20000"),
            metodo_pago=MetodoPago.EFECTIVO,
            motivo="   ",
        )


def test_no_se_puede_devolver_mas_de_lo_cobrado(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)
    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("10000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )

    with pytest.raises(services.MontoExcedeLoPagado):
        services.devolver(
            venta=venta,
            registrado_por=ctx["dueno"],
            monto=Decimal("15000"),
            metodo_pago=MetodoPago.EFECTIVO,
            motivo="Error de cobro",
        )


def test_anular_venta_cobrada_devuelve_y_revierte_comision(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)
    services.registrar_pago(
        venta=venta,
        registrado_por=ctx["dueno"],
        monto=Decimal("20000"),
        metodo_pago=MetodoPago.EFECTIVO,
    )
    venta.refresh_from_db()
    assert ComisionDevengada.objects.count() == 1

    venta = services.anular_venta(
        venta=venta, responsable=ctx["dueno"], motivo="Se cobró al cliente equivocado"
    )

    assert venta.estado == Venta.Estado.ANULADA
    assert venta.total_pagado == Decimal("0")
    assert not ComisionDevengada.objects.exists()
    # Los dos movimientos siguen en el libro: el cobro y su reverso.
    assert MovimientoCaja.objects.count() == 2
    auditoria = RegistroAuditoria.objects.get(accion="venta.anular")
    assert auditoria.detalle["devuelto"] == "20000.00"


def test_venta_anulada_no_se_vuelve_a_cobrar(ctx):
    services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])
    venta = _venta(ctx)
    venta = services.anular_venta(venta=venta, responsable=ctx["dueno"], motivo="Error")

    with pytest.raises(services.VentaNoCobrable):
        services.registrar_pago(
            venta=venta,
            registrado_por=ctx["dueno"],
            monto=Decimal("20000"),
            metodo_pago=MetodoPago.EFECTIVO,
        )


def test_anular_dos_veces_falla(ctx):
    venta = _venta(ctx)
    services.anular_venta(venta=venta, responsable=ctx["dueno"], motivo="Error")

    with pytest.raises(services.VentaYaAnulada):
        services.anular_venta(venta=venta, responsable=ctx["dueno"], motivo="Otra vez")


# --- egresos ---


def test_egreso_resta_de_la_caja_y_queda_categorizado(ctx):
    caja = services.abrir_caja(negocio=ctx["negocio"], responsable=ctx["dueno"])

    movimiento = services.registrar_egreso(
        negocio=ctx["negocio"],
        registrado_por=ctx["dueno"],
        monto=Decimal("80000"),
        concepto="Compra proveedor XYZ",
        categoria=MovimientoCaja.CategoriaEgreso.INSUMOS,
        metodo_pago=MetodoPago.EFECTIVO,
    )

    assert movimiento.tipo == MovimientoCaja.Tipo.EGRESO
    assert movimiento.venta_id is None
    resumen = services.resumen_de(caja)
    assert resumen["total_egresos"] == Decimal("80000")
    assert resumen["egresos_por_categoria"]["insumos"] == Decimal("80000")
