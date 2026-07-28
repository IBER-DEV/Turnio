from django.contrib import admin

from apps.negocios.models import FotoNegocio, Negocio


class FotoNegocioInline(admin.TabularInline):
    """La galería se administra desde el negocio, que es donde tiene
    sentido verla: una foto suelta no dice nada."""

    model = FotoNegocio
    extra = 0
    fields = ["imagen", "orden"]


@admin.register(Negocio)
class NegocioAdmin(admin.ModelAdmin):
    list_display = ["nombre", "tenant", "ciudad", "activo", "creado_en"]
    search_fields = ["nombre", "ciudad"]
    list_filter = ["activo", "ciudad"]
    inlines = [FotoNegocioInline]
