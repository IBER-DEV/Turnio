from django.contrib import admin

from apps.caja.models import Caja, MovimientoCaja, RegistroAuditoria


@admin.register(Caja)
class CajaAdmin(admin.ModelAdmin):
    list_display = ["negocio", "estado", "abierta_por", "abierta_en", "cerrada_en"]
    list_filter = ["estado", "negocio"]
    search_fields = ["negocio__nombre"]


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    list_display = ["caja", "tipo", "monto", "metodo_pago", "concepto", "creado_en"]
    list_filter = ["tipo", "metodo_pago", "negocio"]
    search_fields = ["concepto"]


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    """Solo lectura: nace desde `apps.caja.services`, no desde el admin."""

    list_display = ["accion", "negocio", "actor", "creado_en"]
    list_filter = ["accion", "negocio"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
