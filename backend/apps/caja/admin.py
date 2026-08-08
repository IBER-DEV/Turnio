from django.contrib import admin

from apps.caja.models import (
    Caja,
    ComisionDevengada,
    Devolucion,
    MovimientoCaja,
    Pago,
    RegistroAuditoria,
    Venta,
    VentaItem,
)


@admin.register(Caja)
class CajaAdmin(admin.ModelAdmin):
    list_display = [
        "negocio",
        "estado",
        "abierta_por",
        "abierta_en",
        "cerrada_en",
        "efectivo_esperado",
        "efectivo_contado",
        "diferencia",
    ]
    list_filter = ["estado", "negocio"]
    search_fields = ["negocio__nombre"]


class VentaItemInline(admin.TabularInline):
    model = VentaItem
    extra = 0


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ["id", "negocio", "nombre_cliente", "total", "estado", "creado_en"]
    list_filter = ["estado", "negocio"]
    search_fields = ["nombre_cliente", "telefono_cliente"]
    inlines = [VentaItemInline]


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    """Solo lectura: el libro no se edita desde el admin tampoco.

    Un movimiento equivocado se corrige con una devolución (ver
    `apps.caja.services.devolver`). Dejar el admin abierto sería la
    puerta de atrás que hace falsa la garantía de inmutabilidad que el
    resto del módulo sostiene.
    """

    list_display = ["caja", "tipo", "monto", "metodo_pago", "concepto", "creado_en"]
    list_filter = ["tipo", "metodo_pago", "categoria", "negocio"]
    search_fields = ["concepto"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ["venta", "monto", "metodo_pago", "registrado_por", "creado_en"]
    list_filter = ["metodo_pago", "negocio"]


@admin.register(Devolucion)
class DevolucionAdmin(admin.ModelAdmin):
    list_display = ["venta", "monto", "metodo_pago", "registrado_por", "creado_en"]
    list_filter = ["metodo_pago", "negocio"]


@admin.register(ComisionDevengada)
class ComisionDevengadaAdmin(admin.ModelAdmin):
    list_display = ["empleado", "monto", "venta", "creado_en"]
    list_filter = ["negocio"]


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    """Solo lectura: nace desde `apps.caja.services`, no desde el admin."""

    list_display = ["accion", "negocio", "actor", "creado_en"]
    list_filter = ["accion", "negocio"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
