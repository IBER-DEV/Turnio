from django.contrib import admin

from apps.servicios.models import RegistroServicio, Servicio


@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ["nombre", "negocio", "precio", "duracion_minutos", "activo"]
    list_filter = ["activo", "negocio"]
    search_fields = ["nombre", "negocio__nombre"]


@admin.register(RegistroServicio)
class RegistroServicioAdmin(admin.ModelAdmin):
    list_display = ["servicio", "empleado", "negocio", "estado", "fecha_hora", "creado_en"]
    list_filter = ["estado", "negocio"]
    search_fields = ["nombre_cliente", "servicio__nombre", "empleado__usuario__email"]
