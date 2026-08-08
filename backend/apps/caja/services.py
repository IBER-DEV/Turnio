"""Capa de servicios del dominio de dinero.

**Toda** mutación de caja, ventas, pagos, devoluciones y comisiones pasa
por acá. Dos garantías dependen de eso y no de la base de datos:

1. **Auditoría** — cada acción de negocio deja su fila en
   `RegistroAuditoria`. Un `.save()` directo desde una vista la rompe en
   silencio.
2. **Atomicidad** — crear un pago y su movimiento de caja, completar una
   cita y su venta, o devolver y generar el movimiento inverso son
   operaciones de un solo paso o de ninguno. Todas las funciones que
   escriben más de una fila son `@transaction.atomic`.

Regla de oro del módulo, de la que se derivan casi todas las demás:
**el servicio genera una deuda (`Venta`), el pago genera el movimiento de
dinero (`MovimientoCaja`)**. Y el historial financiero nunca se altera
retroactivamente: un cobro equivocado se corrige con una `Devolucion`,
que es un movimiento nuevo de signo contrario, jamás editando o borrando
el original.
"""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from apps.caja.models import (
    METODOS_EN_EFECTIVO,
    Caja,
    ComisionDevengada,
    Devolucion,
    MovimientoCaja,
    Pago,
    RegistroAuditoria,
    Venta,
    VentaItem,
)

CENTAVO = Decimal("0.01")


# --------------------------------------------------------------------------
# Errores de negocio
#
# Todos se traducen a un 400 con mensaje legible en la capa de vistas. No
# se usan `ValidationError` de DRF acá para que la capa de servicios siga
# siendo usable desde un comando de management o un test sin arrastrar
# HTTP.
# --------------------------------------------------------------------------


class YaHayCajaAbierta(Exception):
    """Ya hay una caja abierta para este negocio; hay que cerrarla antes
    de abrir otra."""


class NoHayCajaAbierta(Exception):
    """No hay ninguna caja abierta para operar (cobrar, registrar un
    egreso, devolver o cerrar)."""


class RecursoDeOtroNegocio(Exception):
    """Se intentó operar sobre algo que no pertenece al negocio del
    solicitante. Es la última red del aislamiento multi-tenant, después
    de los querysets ya acotados de las vistas."""


class VentaSinItems(Exception):
    """Una venta necesita al menos una línea."""


class VentaNoCobrable(Exception):
    """La venta está anulada o ya está saldada: no admite más pagos."""


class MontoExcedeSaldo(Exception):
    """El pago es mayor que lo que falta por cobrar."""


class VentaYaAnulada(Exception):
    """La venta ya fue anulada."""


class MontoExcedeLoPagado(Exception):
    """No se puede devolver más plata de la que entró."""


class MotivoRequerido(Exception):
    """Anular y devolver exigen explicar por qué: son las dos acciones que
    mueven dinero hacia atrás."""


class ArqueoRequerido(Exception):
    """Cerrar la caja exige contar el efectivo."""


# --------------------------------------------------------------------------
# Utilidades internas
# --------------------------------------------------------------------------


def _auditar(*, negocio, actor, accion, detalle):
    return RegistroAuditoria.objects.create(
        tenant=negocio.tenant, negocio=negocio, actor=actor, accion=accion, detalle=detalle
    )


def _exigir_mismo_negocio(negocio, *recursos):
    """Aborta si alguno de `recursos` no es del `negocio` dado.

    Las vistas ya acotan sus querysets al negocio de la membresía, así que
    en la práctica esto nunca debería dispararse desde la API. Está igual
    porque la capa de servicios también se llama desde `apps.agenda`, y
    porque el costo de equivocarse acá es mostrarle a un negocio la plata
    de otro — el peor error posible en un SaaS multi-tenant. Un chequeo
    barato contra una falla que no admite "casi nunca".
    """
    for recurso in recursos:
        if recurso is None:
            continue
        if getattr(recurso, "negocio_id", None) != negocio.id:
            raise RecursoDeOtroNegocio(
                "Ese recurso no pertenece a tu negocio."
            )


def caja_abierta_de(negocio):
    """La caja abierta del negocio, o `None` si no hay ninguna."""
    return negocio.cajas.filter(estado=Caja.Estado.ABIERTA).first()


def _caja_abierta_obligatoria(negocio):
    caja = caja_abierta_de(negocio)
    if caja is None:
        raise NoHayCajaAbierta(
            "No hay ninguna caja abierta. Ábrela antes de registrar movimientos."
        )
    return caja


def total_pagado_de(venta):
    """Lo cobrado neto de devoluciones, **leído de la base**.

    Existe además de `Venta.total_pagado` (la propiedad) porque no son
    intercambiables cuando importa. La propiedad usa `self.pagos.all()`,
    que respeta el caché de `prefetch_related` — perfecto para serializar
    un listado sin N+1, y peligroso acá: la vista entrega la venta ya
    prefetcheada, así que un pago recién creado en esta misma transacción
    no aparece en ese caché y el saldo saldría mal. Toda decisión de
    dinero (¿excede el saldo?, ¿ya quedó pagada?) usa esta función.
    """
    pagado = venta.pagos.aggregate(t=Sum("monto"))["t"] or Decimal("0")
    devuelto = venta.devoluciones.aggregate(t=Sum("monto"))["t"] or Decimal("0")
    return pagado - devuelto


def comision_de_item(item):
    """Lo que le corresponde al empleado por esa línea.

    Sale de `VentaItem.porcentaje_comision` y `VentaItem.precio_unitario`,
    ambos **congelados** al crear la línea — nunca del `Servicio` del
    catálogo, que puede haber cambiado desde entonces.
    """
    return (item.subtotal * item.porcentaje_comision / Decimal("100")).quantize(CENTAVO)


# --------------------------------------------------------------------------
# Caja: apertura y cierre
# --------------------------------------------------------------------------


@transaction.atomic
def abrir_caja(*, negocio, responsable, saldo_inicial=Decimal("0")):
    if caja_abierta_de(negocio) is not None:
        raise YaHayCajaAbierta("Ya hay una caja abierta. Ciérrala antes de abrir otra.")
    try:
        caja = Caja.objects.create(
            tenant=negocio.tenant,
            negocio=negocio,
            abierta_por=responsable,
            saldo_inicial=saldo_inicial,
        )
    except IntegrityError:
        # La constraint de BD (`una_caja_abierta_por_negocio`) atrapó una
        # carrera que el chequeo de arriba no vio — dos requests casi
        # simultáneos. Se relanza de inmediato como el mismo error de
        # negocio, sin tocar la base de nuevo: dentro de este `atomic()`,
        # cualquier otra query después de un `IntegrityError` rompería con
        # `TransactionManagementError` (la conexión queda marcada
        # "necesita rollback").
        raise YaHayCajaAbierta("Ya hay una caja abierta. Ciérrala antes de abrir otra.")
    _auditar(
        negocio=negocio,
        actor=responsable,
        accion="caja.abrir",
        detalle={"caja_id": caja.id, "saldo_inicial": str(saldo_inicial)},
    )
    return caja


def arqueo_de(caja):
    """El cuadre de efectivo de una caja: esperado, y su desglose.

        efectivo_esperado = saldo_inicial
                          + ingresos en efectivo
                          − egresos en efectivo
                          − devoluciones en efectivo

    **Solo efectivo.** Una transferencia por Nequi nunca estuvo en el
    cajón: meterla en el esperado haría que toda caja con pagos digitales
    cerrara con un faltante enorme y perfectamente normal, que es la forma
    más rápida de que el dueño deje de mirar el arqueo. Tarjeta,
    transferencia y demás se concilian por separado, contra el extracto de
    su plataforma — por eso `por_metodo` los devuelve aparte, sin
    diferencia asociada.
    """
    movimientos = caja.movimientos.all()

    def _total(tipo, solo_efectivo):
        qs = movimientos.filter(tipo=tipo)
        if solo_efectivo:
            qs = qs.filter(metodo_pago__in=METODOS_EN_EFECTIVO)
        return qs.aggregate(t=Sum("monto"))["t"] or Decimal("0")

    ingresos_efectivo = _total(MovimientoCaja.Tipo.INGRESO, True)
    egresos_efectivo = _total(MovimientoCaja.Tipo.EGRESO, True)
    devoluciones_efectivo = _total(MovimientoCaja.Tipo.DEVOLUCION, True)

    esperado = (
        caja.saldo_inicial + ingresos_efectivo - egresos_efectivo - devoluciones_efectivo
    )

    return {
        "saldo_inicial": caja.saldo_inicial,
        "ingresos_efectivo": ingresos_efectivo,
        "egresos_efectivo": egresos_efectivo,
        "devoluciones_efectivo": devoluciones_efectivo,
        "efectivo_esperado": esperado,
    }


def resumen_de(caja):
    """Totales de una caja, calculados en caliente desde sus movimientos.

    Nunca se persisten (salvo el arqueo al cerrar, ver `Caja`): un total
    guardado es un número que puede quedar desincronizado de las filas que
    dice resumir.
    """
    movimientos = caja.movimientos.all()

    def _total(tipo):
        return movimientos.filter(tipo=tipo).aggregate(t=Sum("monto"))["t"] or Decimal("0")

    total_ingresos = _total(MovimientoCaja.Tipo.INGRESO)
    total_egresos = _total(MovimientoCaja.Tipo.EGRESO)
    total_devoluciones = _total(MovimientoCaja.Tipo.DEVOLUCION)

    # Ingresos por método, para conciliar lo no-efectivo contra el
    # extracto de cada plataforma.
    por_metodo = {
        fila["metodo_pago"]: fila["t"]
        for fila in movimientos.filter(tipo=MovimientoCaja.Tipo.INGRESO)
        .values("metodo_pago")
        .annotate(t=Sum("monto"))
    }

    egresos_por_categoria = {
        fila["categoria"]: fila["t"]
        for fila in movimientos.filter(tipo=MovimientoCaja.Tipo.EGRESO)
        .values("categoria")
        .annotate(t=Sum("monto"))
    }

    comisiones = {}
    devengadas = ComisionDevengada.objects.filter(
        venta__movimientos__caja=caja
    ).select_related("empleado__usuario").distinct()
    for comision in devengadas:
        fila = comisiones.setdefault(
            comision.empleado_id,
            {
                "empleado": comision.empleado_id,
                "empleado_nombre": comision.empleado.usuario.nombre,
                "monto": Decimal("0"),
            },
        )
        fila["monto"] += comision.monto

    # Sin acotar por fecha a propósito: una venta que nadie cobró sigue
    # siendo plata pendiente aunque haya pasado el día en que se hizo el
    # trabajo. Acotarlo a la ventana de esta caja la haría desaparecer del
    # aviso en cuanto el día termina — justo lo opuesto de lo que este
    # conteo existe para proteger.
    ventas_sin_cobrar = Venta.objects.filter(
        negocio=caja.negocio,
        estado__in=[Venta.Estado.PENDIENTE, Venta.Estado.PARCIAL],
    ).count()

    return {
        "total_ingresos": total_ingresos,
        "total_egresos": total_egresos,
        "total_devoluciones": total_devoluciones,
        "neto": total_ingresos - total_egresos - total_devoluciones,
        "por_metodo_pago": por_metodo,
        "egresos_por_categoria": egresos_por_categoria,
        "comisiones_por_empleado": list(comisiones.values()),
        "ventas_sin_cobrar": ventas_sin_cobrar,
        **arqueo_de(caja),
    }


@transaction.atomic
def cerrar_caja(*, caja, responsable, efectivo_contado, nota_cierre=""):
    """Cierra la jornada con arqueo obligatorio.

    Congela `efectivo_esperado`, `efectivo_contado` y su `diferencia` (ver
    `Caja`): el arqueo es una afirmación sobre un instante, no una cifra
    viva. Una diferencia negativa es un faltante; **no bloquea el cierre**
    — el faltante existe, negarse a cerrar no lo hace desaparecer y sí
    deja al negocio sin poder operar al día siguiente. Queda registrado y
    auditado, que es lo que sirve para investigarlo.
    """
    if caja.estado != Caja.Estado.ABIERTA:
        raise NoHayCajaAbierta("Esta caja ya está cerrada.")
    if efectivo_contado is None:
        raise ArqueoRequerido("Para cerrar la caja hay que contar el efectivo.")

    arqueo = arqueo_de(caja)
    esperado = arqueo["efectivo_esperado"]

    caja.estado = Caja.Estado.CERRADA
    caja.cerrada_por = responsable
    caja.cerrada_en = timezone.now()
    caja.nota_cierre = nota_cierre
    caja.efectivo_esperado = esperado
    caja.efectivo_contado = efectivo_contado
    caja.diferencia = efectivo_contado - esperado
    caja.save(
        update_fields=[
            "estado",
            "cerrada_por",
            "cerrada_en",
            "nota_cierre",
            "efectivo_esperado",
            "efectivo_contado",
            "diferencia",
        ]
    )

    _auditar(
        negocio=caja.negocio,
        actor=responsable,
        accion="caja.cerrar",
        detalle={
            "caja_id": caja.id,
            "efectivo_esperado": str(esperado),
            "efectivo_contado": str(efectivo_contado),
            "diferencia": str(caja.diferencia),
        },
    )
    return caja


# --------------------------------------------------------------------------
# Ventas
# --------------------------------------------------------------------------


@transaction.atomic
def crear_venta(
    *,
    negocio,
    creada_por,
    nombre_cliente,
    items,
    cita=None,
    telefono_cliente="",
    observaciones="",
    evidencia=None,
):
    """Crea una venta en `pendiente` con sus líneas.

    `items` es una lista de dicts con `empleado` (obligatorio) y, o bien
    `servicio` —de donde se copian descripción, precio y porcentaje de
    comisión—, o bien `descripcion` y `precio_unitario` a mano, para lo
    que todavía no tiene catálogo (un producto suelto). `cantidad` es
    opcional y por defecto 1.

    **Nada acá toca dinero**: crear la venta no genera ningún movimiento
    de caja, y por eso no exige que haya una caja abierta. Un servicio
    hecho a las 7pm con la caja ya cerrada sigue siendo una deuda del
    cliente que mañana alguien cobra.
    """
    if not items:
        raise VentaSinItems("Una venta necesita al menos un servicio o producto.")

    _exigir_mismo_negocio(negocio, cita, creada_por)

    venta = Venta.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        cita=cita,
        nombre_cliente=nombre_cliente,
        telefono_cliente=telefono_cliente,
        observaciones=observaciones,
        evidencia=evidencia or "",
        creada_por=creada_por,
    )

    total = Decimal("0")
    for datos in items:
        servicio = datos.get("servicio")
        empleado = datos["empleado"]
        _exigir_mismo_negocio(negocio, servicio, empleado)

        # Precio y comisión se copian del catálogo **ahora** y no se
        # vuelven a leer: la venta de hoy no puede cambiar porque mañana
        # suban el precio del corte.
        if servicio is not None:
            descripcion = datos.get("descripcion") or servicio.nombre
            precio = datos.get("precio_unitario")
            if precio is None:
                precio = servicio.precio
            porcentaje = datos.get("porcentaje_comision")
            if porcentaje is None:
                porcentaje = servicio.porcentaje_comision
        else:
            descripcion = datos["descripcion"]
            precio = datos["precio_unitario"]
            porcentaje = datos.get("porcentaje_comision") or Decimal("0")

        item = VentaItem.objects.create(
            tenant=negocio.tenant,
            negocio=negocio,
            venta=venta,
            servicio=servicio,
            empleado=empleado,
            descripcion=descripcion,
            precio_unitario=precio,
            cantidad=datos.get("cantidad") or 1,
            porcentaje_comision=porcentaje,
        )
        total += item.subtotal

    venta.total = total
    venta.save(update_fields=["total", "actualizado_en"])

    _auditar(
        negocio=negocio,
        actor=creada_por,
        accion="venta.crear",
        detalle={
            "venta_id": venta.id,
            "cita_id": cita.id if cita else None,
            "total": str(total),
            "items": len(items),
        },
    )
    return venta


def _devengar_comisiones(venta):
    """Fija las comisiones de la venta. Idempotente.

    Se llama **una sola vez**, cuando la venta queda saldada — no en cada
    pago. `get_or_create` sobre el `OneToOne` del item es lo que hace que
    llamarla de nuevo (por un pago parcial que completa, y luego otro
    intento) no duplique nada.
    """
    for item in venta.items.select_related("empleado"):
        ComisionDevengada.objects.get_or_create(
            item=item,
            defaults={
                "tenant": venta.tenant,
                "negocio": venta.negocio,
                "venta": venta,
                "empleado": item.empleado,
                "monto": comision_de_item(item),
            },
        )


def _recalcular_estado(venta):
    """Reevalúa `pendiente`/`parcial`/`pagada` desde los pagos reales.

    Una venta anulada no se mueve de ahí: anular es terminal.
    """
    if venta.estado == Venta.Estado.ANULADA:
        return venta

    pagado = total_pagado_de(venta)
    if pagado <= Decimal("0"):
        venta.estado = Venta.Estado.PENDIENTE
    elif pagado >= venta.total:
        venta.estado = Venta.Estado.PAGADA
    else:
        venta.estado = Venta.Estado.PARCIAL
    venta.save(update_fields=["estado", "actualizado_en"])

    if venta.estado == Venta.Estado.PAGADA:
        _devengar_comisiones(venta)
    return venta


@transaction.atomic
def registrar_pago(*, venta, registrado_por, monto, metodo_pago):
    """Cobra (total o parcialmente) una venta.

    Crea el `Pago` **y** su `MovimientoCaja` de ingreso en la misma
    transacción: no puede existir uno sin el otro, porque eso sería o
    plata cobrada que la caja no ve, o plata en la caja que ninguna venta
    explica.

    Varios pagos sobre la misma venta son el caso normal, no la excepción:
    así se modela el pago mixto ($40.000 en efectivo + $60.000 por
    transferencia son dos llamadas a esta función).
    """
    negocio = venta.negocio
    _exigir_mismo_negocio(negocio, registrado_por)

    if venta.estado == Venta.Estado.ANULADA:
        raise VentaNoCobrable("Esa venta está anulada.")
    if venta.estado == Venta.Estado.PAGADA:
        raise VentaNoCobrable("Esa venta ya está pagada por completo.")

    monto = Decimal(monto).quantize(CENTAVO)
    saldo = venta.total - total_pagado_de(venta)
    if monto > saldo:
        raise MontoExcedeSaldo(f"El pago excede lo que falta por cobrar (${saldo}).")

    caja = _caja_abierta_obligatoria(negocio)

    movimiento = MovimientoCaja.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        caja=caja,
        registrado_por=registrado_por,
        tipo=MovimientoCaja.Tipo.INGRESO,
        metodo_pago=metodo_pago,
        monto=monto,
        concepto=f"Venta #{venta.id} — {venta.nombre_cliente}",
        venta=venta,
    )
    pago = Pago.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        venta=venta,
        movimiento=movimiento,
        monto=monto,
        metodo_pago=metodo_pago,
        registrado_por=registrado_por,
    )

    _recalcular_estado(venta)
    _auditar(
        negocio=negocio,
        actor=registrado_por,
        accion="venta.cobrar",
        detalle={
            "venta_id": venta.id,
            "pago_id": pago.id,
            "movimiento_id": movimiento.id,
            "monto": str(monto),
            "metodo_pago": metodo_pago,
            "estado_venta": venta.estado,
        },
    )
    return pago


@transaction.atomic
def registrar_egreso(
    *, negocio, registrado_por, monto, concepto, categoria, metodo_pago
):
    """Plata que sale por un gasto del negocio (insumos, arriendo, domicilio).

    Independiente de las ventas por diseño: un egreso no tiene contraparte
    en una venta, y mezclarlo con las devoluciones haría que el reporte de
    gastos mienta (ver `MovimientoCaja`).
    """
    _exigir_mismo_negocio(negocio, registrado_por)
    caja = _caja_abierta_obligatoria(negocio)

    movimiento = MovimientoCaja.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        caja=caja,
        registrado_por=registrado_por,
        tipo=MovimientoCaja.Tipo.EGRESO,
        metodo_pago=metodo_pago,
        monto=Decimal(monto).quantize(CENTAVO),
        concepto=concepto,
        categoria=categoria,
    )
    _auditar(
        negocio=negocio,
        actor=registrado_por,
        accion="caja.egreso",
        detalle={
            "movimiento_id": movimiento.id,
            "monto": str(movimiento.monto),
            "categoria": categoria,
            "concepto": concepto,
        },
    )
    return movimiento


@transaction.atomic
def devolver(*, venta, registrado_por, monto, metodo_pago, motivo):
    """Devuelve plata al cliente sobre una venta ya cobrada.

    **La única forma de corregir dinero ya registrado.** No edita ni borra
    el movimiento original: crea uno nuevo de tipo `devolucion`, de modo
    que el cobro y su reverso quedan los dos en el libro. El arqueo de la
    caja donde entró la plata sigue siendo cierto, y el de hoy refleja que
    salió.
    """
    negocio = venta.negocio
    _exigir_mismo_negocio(negocio, registrado_por)

    if not motivo or not motivo.strip():
        raise MotivoRequerido("Explica por qué se devuelve la plata.")

    monto = Decimal(monto).quantize(CENTAVO)
    cobrado = total_pagado_de(venta)
    if monto > cobrado:
        raise MontoExcedeLoPagado(f"No puedes devolver más de lo que se cobró (${cobrado}).")

    caja = _caja_abierta_obligatoria(negocio)

    movimiento = MovimientoCaja.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        caja=caja,
        registrado_por=registrado_por,
        tipo=MovimientoCaja.Tipo.DEVOLUCION,
        metodo_pago=metodo_pago,
        monto=monto,
        concepto=f"Devolución venta #{venta.id} — {venta.nombre_cliente}",
        venta=venta,
    )
    devolucion = Devolucion.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        venta=venta,
        movimiento=movimiento,
        monto=monto,
        metodo_pago=metodo_pago,
        motivo=motivo.strip(),
        registrado_por=registrado_por,
    )

    # Devolver todo deja la venta en `pendiente` de nuevo, no en
    # `anulada`: se devolvió la plata, pero el trabajo se hizo y alguien
    # tiene que decidir qué pasa con él. Anular es una decisión explícita
    # aparte (`anular_venta`).
    _recalcular_estado(venta)

    _auditar(
        negocio=negocio,
        actor=registrado_por,
        accion="venta.devolver",
        detalle={
            "venta_id": venta.id,
            "devolucion_id": devolucion.id,
            "movimiento_id": movimiento.id,
            "monto": str(monto),
            "motivo": devolucion.motivo,
        },
    )
    return devolucion


@transaction.atomic
def anular_venta(*, venta, responsable, motivo, metodo_devolucion=None):
    """Anula una venta. Si ya tenía plata cobrada, la devuelve primero.

    Anular es terminal: la venta no vuelve a cobrarse. Lo que **no** hace
    es borrar nada — si había cobros, genera la `Devolucion` por el saldo
    cobrado (y por lo tanto su movimiento inverso), así que en el libro
    quedan las dos mitades del hecho.

    Las comisiones devengadas sí se borran: no son movimientos de caja
    sino el cálculo de lo que se le debe al empleado, y por un trabajo
    anulado no se le debe nada. La fila de auditoría deja constancia de
    cuánto se revirtió.
    """
    negocio = venta.negocio
    _exigir_mismo_negocio(negocio, responsable)

    if venta.estado == Venta.Estado.ANULADA:
        raise VentaYaAnulada("Esa venta ya está anulada.")
    if not motivo or not motivo.strip():
        raise MotivoRequerido("Explica por qué se anula esta venta.")

    cobrado = total_pagado_de(venta)
    if cobrado > Decimal("0"):
        devolver(
            venta=venta,
            registrado_por=responsable,
            monto=cobrado,
            metodo_pago=metodo_devolucion or venta.pagos.first().metodo_pago,
            motivo=f"Anulación: {motivo.strip()}",
        )

    comisiones_revertidas = list(
        venta.comisiones.values_list("empleado_id", "monto")
    )
    venta.comisiones.all().delete()

    venta.estado = Venta.Estado.ANULADA
    venta.anulada_por = responsable
    venta.anulada_en = timezone.now()
    venta.motivo_anulacion = motivo.strip()
    venta.save(
        update_fields=[
            "estado",
            "anulada_por",
            "anulada_en",
            "motivo_anulacion",
            "actualizado_en",
        ]
    )

    _auditar(
        negocio=negocio,
        actor=responsable,
        accion="venta.anular",
        detalle={
            "venta_id": venta.id,
            "motivo": venta.motivo_anulacion,
            "devuelto": str(cobrado),
            "comisiones_revertidas": [
                {"empleado": empleado_id, "monto": str(monto)}
                for empleado_id, monto in comisiones_revertidas
            ],
        },
    )
    return venta
