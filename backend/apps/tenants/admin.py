from django.contrib import admin

from apps.tenants.models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ["nombre", "activo", "creado_en"]
    search_fields = ["nombre"]
