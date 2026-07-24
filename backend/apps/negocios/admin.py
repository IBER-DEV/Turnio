from django.contrib import admin

from apps.negocios.models import Negocio


@admin.register(Negocio)
class NegocioAdmin(admin.ModelAdmin):
    list_display = ["nombre", "tenant", "ciudad", "activo", "creado_en"]
    search_fields = ["nombre", "ciudad"]
    list_filter = ["activo", "ciudad"]
