from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from apps.caja.models import Caja, MovimientoCaja, RegistroAuditoria
from apps.servicios.models import RegistroServicio
from apps.servicios.services import calcular_comision


class YaHayCajaAbierta(Exception):
    """Ya hay una caja abierta para este negocio; hay que cerrarla antes
    de abrir otra."""


class NoHayCajaAbierta(Exception):
    """No hay ninguna caja abierta para operar (registrar un movimiento o
    cerrar)."""


class RegistroServicioNoAprobado(Exception):
    """Solo se puede cobrar un `RegistroServicio` que ya fue aprobado."""


class RegistroServicioYaVinculado(Exception):
    """Ese `RegistroServicio` ya tiene un movimiento de caja — no se puede
    cobrar el mismo trabajo dos veces."""


def _auditar(*, negocio, actor, accion, detalle):
    return RegistroAuditoria.objects.create(
        tenant=negocio.tenant, negocio=negocio, actor=actor, accion=accion, detalle=detalle
    )


def caja_abierta_de(negocio):
    """La caja abierta del negocio, o `None` si no hay ninguna."""
    return negocio.cajas.filter(estado=Caja.Estado.ABIERTA).first()


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


@transaction.atomic
def registrar_movimiento(
    *,
    caja,
    registrado_por,
    tipo,
    monto,
    concepto,
    metodo_pago="",
    registro_servicio=None,
    empleado_comision=None,
):
    """Registra un ingreso o egreso sobre una caja abierta.

    Si `registro_servicio` viene, tiene que estar ya aprobado y sin un
    movimiento previo (la constraint `un_movimiento_por_registro_servicio`
    es la red de seguridad real; acá se valida antes para el mensaje
    legible). El vínculo **sobreescribe** cualquier `empleado_comision`
    que se haya mandado: la comisión es de quien hizo el trabajo, nunca
    de a quién se le ocurra asignársela — sin esto, alguien podría
    vincular el registro de un compañero y quedarse con su comisión.
    """
    if caja.estado != Caja.Estado.ABIERTA:
        raise NoHayCajaAbierta("Esta caja ya está cerrada.")

    monto_comision = None
    if registro_servicio is not None:
        if registro_servicio.estado != RegistroServicio.Estado.APROBADO:
            raise RegistroServicioNoAprobado("Solo puedes cobrar un servicio ya aprobado.")
        if MovimientoCaja.objects.filter(registro_servicio=registro_servicio).exists():
            raise RegistroServicioYaVinculado(
                "Ese servicio ya tiene un movimiento de caja registrado."
            )
        empleado_comision = registro_servicio.empleado
        monto_comision = calcular_comision(servicio=registro_servicio.servicio, monto=monto)

    movimiento = MovimientoCaja.objects.create(
        tenant=caja.tenant,
        negocio=caja.negocio,
        caja=caja,
        registrado_por=registrado_por,
        tipo=tipo,
        metodo_pago=metodo_pago,
        monto=monto,
        concepto=concepto,
        registro_servicio=registro_servicio,
        empleado_comision=empleado_comision,
        monto_comision=monto_comision,
    )
    _auditar(
        negocio=caja.negocio,
        actor=registrado_por,
        accion="caja.movimiento.crear",
        detalle={
            "movimiento_id": movimiento.id,
            "tipo": tipo,
            "monto": str(monto),
            "registro_servicio_id": registro_servicio.id if registro_servicio else None,
        },
    )
    return movimiento


@transaction.atomic
def cerrar_caja(*, caja, responsable, nota_cierre=""):
    if caja.estado != Caja.Estado.ABIERTA:
        raise NoHayCajaAbierta("Esta caja ya está cerrada.")

    caja.estado = Caja.Estado.CERRADA
    caja.cerrada_por = responsable
    caja.cerrada_en = timezone.now()
    caja.nota_cierre = nota_cierre
    caja.save(update_fields=["estado", "cerrada_por", "cerrada_en", "nota_cierre"])

    resumen = resumen_de(caja)
    _auditar(
        negocio=caja.negocio,
        actor=responsable,
        accion="caja.cerrar",
        detalle={
            "caja_id": caja.id,
            "total_ingresos": str(resumen["total_ingresos"]),
            "total_egresos": str(resumen["total_egresos"]),
            "neto": str(resumen["neto"]),
        },
    )
    return caja


def resumen_de(caja):
    """Totales de una caja, siempre calculados en caliente desde sus
    movimientos — nunca persistidos aparte, para no arrastrar un número
    que se desincronice si algo cambia."""
    movimientos = caja.movimientos.all()

    total_ingresos = (
        movimientos.filter(tipo=MovimientoCaja.Tipo.INGRESO).aggregate(t=Sum("monto"))["t"]
        or Decimal("0")
    )
    total_egresos = (
        movimientos.filter(tipo=MovimientoCaja.Tipo.EGRESO).aggregate(t=Sum("monto"))["t"]
        or Decimal("0")
    )

    por_metodo_pago = {
        fila["metodo_pago"]: fila["t"]
        for fila in movimientos.filter(tipo=MovimientoCaja.Tipo.INGRESO)
        .values("metodo_pago")
        .annotate(t=Sum("monto"))
    }

    comisiones = {}
    movimientos_con_comision = movimientos.filter(monto_comision__isnull=False).select_related(
        "empleado_comision__usuario"
    )
    for movimiento in movimientos_con_comision:
        empleado = movimiento.empleado_comision
        fila = comisiones.setdefault(
            empleado.id,
            {"empleado": empleado.id, "empleado_nombre": empleado.usuario.nombre, "monto": Decimal("0")},
        )
        fila["monto"] += movimiento.monto_comision

    # Sin acotar por fecha a propósito: un servicio aprobado que nadie
    # cobró sigue siendo plata pendiente aunque haya pasado el día en que
    # se hizo. Acotarlo a la ventana de esta caja lo haría desaparecer del
    # aviso en cuanto el día termina — justo lo opuesto de lo que este
    # conteo existe para proteger.
    servicios_aprobados_sin_cobrar = (
        RegistroServicio.objects.filter(
            negocio=caja.negocio, estado=RegistroServicio.Estado.APROBADO
        )
        .exclude(movimientos_caja__isnull=False)
        .count()
    )

    return {
        "total_ingresos": total_ingresos,
        "total_egresos": total_egresos,
        "neto": total_ingresos - total_egresos,
        "por_metodo_pago": por_metodo_pago,
        "comisiones_por_empleado": list(comisiones.values()),
        "servicios_aprobados_sin_cobrar": servicios_aprobados_sin_cobrar,
    }
