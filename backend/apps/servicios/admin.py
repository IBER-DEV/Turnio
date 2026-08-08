from django.contrib import admin

from apps.servicios.models import Servicio


@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ["nombre", "negocio", "precio", "duracion_minutos", "activo"]
    list_filter = ["activo", "negocio"]
    search_fields = ["nombre", "negocio__nombre"]
