from decimal import Decimal

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


def calcular_comision(*, servicio, monto=None):
    """Monto de comisión de un servicio dado su porcentaje configurado.

    No se invoca todavía desde ningún flujo automático: la ejecución
    real (al completar una cita y registrar el cobro) es de Fase 3,
    cuando exista el módulo de Caja. Se deja lista acá porque la
    fórmula es propia del Servicio, no de Caja.
    """
    base = monto if monto is not None else servicio.precio
    return (base * servicio.porcentaje_comision / Decimal("100")).quantize(Decimal("0.01"))
