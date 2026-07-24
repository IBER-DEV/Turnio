from decimal import Decimal

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
