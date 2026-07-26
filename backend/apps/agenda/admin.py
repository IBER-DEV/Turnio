from django.contrib import admin

from apps.agenda.models import Cita, HorarioNegocio, HorarioTrabajo


@admin.register(HorarioNegocio)
class HorarioNegocioAdmin(admin.ModelAdmin):
    list_display = ["negocio", "dia_semana", "hora_inicio", "hora_fin"]
    list_filter = ["dia_semana", "negocio"]


@admin.register(HorarioTrabajo)
class HorarioTrabajoAdmin(admin.ModelAdmin):
    list_display = ["miembro", "dia_semana", "hora_inicio", "hora_fin"]
    list_filter = ["dia_semana"]


@admin.register(Cita)
class CitaAdmin(admin.ModelAdmin):
    list_display = ["nombre_cliente", "servicio", "empleado", "fecha_hora_inicio", "estado"]
    list_filter = ["estado", "negocio"]
    search_fields = ["nombre_cliente", "telefono_cliente"]
