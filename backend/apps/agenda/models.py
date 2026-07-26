from django.db import models

from apps.common.models import TenantScopedModel


class DiaSemana(models.IntegerChoices):
    LUNES = 0, "Lunes"
    MARTES = 1, "Martes"
    MIERCOLES = 2, "Miércoles"
    JUEVES = 3, "Jueves"
    VIERNES = 4, "Viernes"
    SABADO = 5, "Sábado"
    DOMINGO = 6, "Domingo"


class HorarioNegocio(TenantScopedModel):
    """Bloque recurrente de las horas en que el negocio atiende.

    Es la **fuente de verdad** de la disponibilidad: todo empleado hereda
    este horario salvo que tenga uno propio cargado (ver
    `HorarioTrabajo`). Antes no existía, y el horario había que cargarlo
    empleado por empleado aunque el equipo entero trabajara igual —
    duplicando el mismo dato N veces y dejando a cada empleado nuevo sin
    disponibilidad hasta que alguien se acordara de asignársela.

    Igual que el horario por empleado, admite varios bloques el mismo día
    para modelar el cierre de mediodía.
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="horarios"
    )
    dia_semana = models.IntegerField(choices=DiaSemana.choices)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    class Meta:
        ordering = ["dia_semana", "hora_inicio"]

    def __str__(self):
        return f"{self.negocio} - {self.get_dia_semana_display()} {self.hora_inicio}-{self.hora_fin}"


class HorarioTrabajo(TenantScopedModel):
    """Horario propio de un empleado, que **reemplaza** al del negocio.

    Es la excepción, no la regla: si un empleado no tiene ninguna fila
    acá, trabaja el horario del negocio (`HorarioNegocio`). Existe para
    el barbero de medio tiempo, el que solo viene sábados o el que hace
    turno de tarde.

    Cuando un empleado sí tiene horario propio, ese horario es el suyo
    completo: no se interseca con el del negocio (ver
    `apps.agenda.services._franjas_vigentes`).

    Un empleado puede tener varios bloques por día (ej. mañana y
    tarde con descanso al medio día). No modela excepciones puntuales
    (vacaciones, incapacidad) todavía: se deja como refinamiento
    futuro si la operación real lo pide.
    """

    miembro = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.CASCADE, related_name="horarios"
    )
    dia_semana = models.IntegerField(choices=DiaSemana.choices)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    class Meta:
        ordering = ["dia_semana", "hora_inicio"]

    def __str__(self):
        return f"{self.miembro} - {self.get_dia_semana_display()} {self.hora_inicio}-{self.hora_fin}"


class Cita(TenantScopedModel):
    class Estado(models.TextChoices):
        AGENDADA = "agendada", "Agendada"
        CONFIRMADA = "confirmada", "Confirmada"
        COMPLETADA = "completada", "Completada"
        CANCELADA = "cancelada", "Cancelada"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="citas"
    )
    empleado = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="citas"
    )
    servicio = models.ForeignKey(
        "servicios.Servicio", on_delete=models.PROTECT, related_name="citas"
    )

    fecha_hora_inicio = models.DateTimeField()
    fecha_hora_fin = models.DateTimeField()
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.AGENDADA
    )

    nombre_cliente = models.CharField(max_length=150)
    telefono_cliente = models.CharField(max_length=30, blank=True)
    notas = models.TextField(blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["fecha_hora_inicio"]

    def __str__(self):
        return f"{self.nombre_cliente} - {self.servicio.nombre} ({self.fecha_hora_inicio})"
