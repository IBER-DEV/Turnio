from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.servicios.models import RegistroServicio, Servicio
from apps.servicios.signals import servicio_aprobado


def crear_servicio(*, negocio, nombre, precio, duracion_minutos, **campos_opcionales):
    return Servicio.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        nombre=nombre,
        precio=precio,
        duracion_minutos=duracion_minutos,
        **campos_opcionales,
    )


@transaction.atomic
def crear_servicios_en_lote(*, negocio, servicios):
    """Crea varios servicios de una, o ninguno.

    Existe para el alta desde catálogo del frontend, que antes mandaba
    un POST por servicio: con 10 servicios marcados y la red de un local
    comercial, era normal que entraran 7 y fallaran 3, dejando al usuario
    sin saber cuáles reintentar.

    `servicios` es una lista de dicts ya validados por el serializer.
    """
    return Servicio.objects.bulk_create(
        [
            Servicio(tenant=negocio.tenant, negocio=negocio, **datos)
            for datos in servicios
        ]
    )


def calcular_comision(*, servicio, monto=None):
    """Monto de comisión de un servicio dado su porcentaje configurado.

    Se queda en `apps.servicios` porque la fórmula es propia del
    `Servicio` (su `porcentaje_comision`), no de `apps.caja`, que la
    importa directamente al registrar un movimiento vinculado a un
    `RegistroServicio` aprobado (`apps.caja.services.registrar_movimiento`).
    """
    base = monto if monto is not None else servicio.precio
    return (base * servicio.porcentaje_comision / Decimal("100")).quantize(Decimal("0.01"))


class FechaFutura(Exception):
    """`fecha_hora` es posterior a ahora: no se puede registrar un
    servicio que todavía no ha pasado."""


class RegistroYaRevisado(Exception):
    """El registro ya fue aprobado o rechazado; no admite una segunda
    revisión."""


class MotivoRechazoRequerido(Exception):
    """Rechazar exige explicar por qué."""


class NoPuedeAutoaprobarse(Exception):
    """Quien registró el servicio no puede ser también quien lo revisa."""


def registrar_servicio(
    *,
    negocio,
    empleado,
    servicio,
    nombre_cliente,
    fecha_hora,
    telefono_cliente="",
    observaciones="",
    evidencia=None,
):
    """Deja un `RegistroServicio` en `pendiente`.

    No genera comisión, historial ni estadística: eso solo ocurre si
    `aprobar_registro` lo confirma después. `empleado` es quien lo hizo
    **y** quien lo registra — lo fija siempre el llamador a partir de la
    membresía autenticada, nunca un id que venga del cliente, para que
    nadie registre trabajo a nombre de otro.
    """
    if fecha_hora > timezone.now():
        raise FechaFutura("No puedes registrar un servicio que todavía no ha ocurrido.")

    return RegistroServicio.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        empleado=empleado,
        servicio=servicio,
        nombre_cliente=nombre_cliente,
        telefono_cliente=telefono_cliente,
        fecha_hora=fecha_hora,
        observaciones=observaciones,
        evidencia=evidencia or "",
    )


def _validar_revision(*, registro, revisor):
    if registro.estado != RegistroServicio.Estado.PENDIENTE:
        raise RegistroYaRevisado(
            f"Este registro ya fue {registro.get_estado_display().lower()}; no admite otra revisión."
        )
    if revisor.pk == registro.empleado_id:
        raise NoPuedeAutoaprobarse(
            "No puedes aprobar ni rechazar un servicio que registraste tú mismo. "
            "Pídeselo a otra persona que valide servicios."
        )


@transaction.atomic
def aprobar_registro(*, registro, revisor):
    """Aprueba el registro: desde acá es de verdad trabajo confirmado.

    Envía la señal `servicio_aprobado`, sin ningún receptor conectado a
    propósito: cobrar un servicio ya aprobado (`apps.caja.services.
    registrar_movimiento`) importa `calcular_comision()` directamente en
    vez de escuchar esta señal — es un solo efecto síncrono, y
    `backend/CLAUDE.md` reserva las señales para cuando un mismo hecho de
    negocio necesita disparar **varios** efectos desacoplados. La señal
    se deja igual, como punto de extensión para ese caso futuro (ej. una
    notificación), no para el cálculo de comisión.
    """
    _validar_revision(registro=registro, revisor=revisor)

    registro.estado = RegistroServicio.Estado.APROBADO
    registro.aprobado_por = revisor
    registro.fecha_revision = timezone.now()
    registro.save(update_fields=["estado", "aprobado_por", "fecha_revision", "actualizado_en"])

    servicio_aprobado.send(sender=RegistroServicio, registro=registro)
    return registro


def rechazar_registro(*, registro, revisor, motivo):
    """Rechaza el registro dejando el motivo, que el empleado podrá leer
    en su propio historial."""
    if not motivo.strip():
        raise MotivoRechazoRequerido("Explica por qué se rechaza este registro.")
    _validar_revision(registro=registro, revisor=revisor)

    registro.estado = RegistroServicio.Estado.RECHAZADO
    registro.aprobado_por = revisor
    registro.fecha_revision = timezone.now()
    registro.motivo_rechazo = motivo.strip()
    registro.save(
        update_fields=[
            "estado",
            "aprobado_por",
            "fecha_revision",
            "motivo_rechazo",
            "actualizado_en",
        ]
    )
    return registro
