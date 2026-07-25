from decimal import Decimal

from django.db import transaction

from apps.servicios.models import Servicio


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

    No se invoca todavía desde ningún flujo automático: la ejecución
    real (al completar una cita y registrar el cobro) es de Fase 3,
    cuando exista el módulo de Caja. Se deja lista acá porque la
    fórmula es propia del Servicio, no de Caja.
    """
    base = monto if monto is not None else servicio.precio
    return (base * servicio.porcentaje_comision / Decimal("100")).quantize(Decimal("0.01"))
