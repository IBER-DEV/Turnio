from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TenantScopedModel


class Servicio(TenantScopedModel):
    """Un servicio que un negocio ofrece (corte, manicure, tratamiento...).

    `porcentaje_comision` es solo configuración en esta fase: el cálculo
    real de comisiones al completar una cita y registrar el cobro es de
    Fase 3 (módulo de Caja/Comisiones), cuando exista el pago asociado.
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="servicios"
    )
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=100, blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    duracion_minutos = models.PositiveIntegerField()
    porcentaje_comision = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.negocio.nombre})"


#: Peso máximo de la evidencia fotográfica. Mismo límite que las imágenes
#: del negocio (`apps.negocios.models.PESO_MAXIMO_IMAGEN_BYTES`): una foto
#: de celular sin comprimir cabe, un archivo sin pasar por ninguna app no
#: debería llegar al disco.
PESO_MAXIMO_EVIDENCIA_BYTES = 5 * 1024 * 1024


def ruta_evidencia(instancia, nombre_archivo):
    """`servicios/<negocio_id>/evidencias/<aleatorio><.ext>`.

    Mismo criterio que `apps.negocios.models.ruta_foto`: nombre aleatorio
    y no el original, que viene de un dispositivo de quien registra el
    servicio y no debería escribirse tal cual en disco.
    """
    extension = Path(nombre_archivo).suffix.lower()
    return f"servicios/{instancia.negocio_id}/evidencias/{uuid4().hex}{extension}"


class RegistroServicio(TenantScopedModel):
    """Un servicio que un empleado dice haber realizado, pendiente de que
    alguien lo confirme.

    Independiente de `Cita` a propósito: cubre tanto una cita que sí
    estaba agendada como un cliente que llegó sin cita (walk-in). No
    genera nada —ni comisión, ni estadística, ni historial— hasta que
    pasa por `aprobar_registro`. Ese es el punto entero del modelo: sin
    esto, cualquiera con acceso a la cuenta podía inventar trabajo para
    inflar sus cifras.

    `empleado` es quien lo realizó **y** quien lo registra: no hay un
    campo `creado_por` aparte porque en este flujo son siempre la misma
    persona (ver `apps.servicios.services.registrar_servicio`, que fija
    `empleado` desde la membresía del token, nunca desde el body).
    """

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADO = "aprobado", "Aprobado"
        RECHAZADO = "rechazado", "Rechazado"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="registros_servicio"
    )
    empleado = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="registros_servicio"
    )
    servicio = models.ForeignKey(
        "servicios.Servicio", on_delete=models.PROTECT, related_name="registros"
    )

    nombre_cliente = models.CharField(max_length=150)
    telefono_cliente = models.CharField(max_length=30, blank=True)
    fecha_hora = models.DateTimeField(
        help_text="Cuándo ocurrió el servicio. No puede ser futura."
    )
    observaciones = models.TextField(blank=True)
    # Sin `null=True`: mismo criterio que `Negocio.logo` — "sin evidencia"
    # es la cadena vacía, no NULL.
    evidencia = models.ImageField(upload_to=ruta_evidencia, blank=True)

    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    # Quién revisó (aprobó o rechazó) y cuándo. Un solo par de campos para
    # los dos desenlaces: el `estado` ya dice cuál fue.
    aprobado_por = models.ForeignKey(
        "usuarios.MiembroNegocio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="registros_revisados",
    )
    fecha_revision = models.DateTimeField(null=True, blank=True)
    # Solo tiene contenido cuando `estado == RECHAZADO`. El barbero lo lee
    # en su propio historial: es lo que le explica qué pasó.
    motivo_rechazo = models.TextField(blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.servicio.nombre} de {self.empleado} ({self.estado})"
