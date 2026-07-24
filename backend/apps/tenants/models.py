import uuid

from django.db import models


class Tenant(models.Model):
    """Cuenta de facturación/propiedad de más alto nivel.

    En el MVP un Tenant tiene un único Negocio asociado, pero se modelan
    como entidades separadas para soportar multi-sucursal (Fase 6) sin
    necesitar una migración de datos: un Tenant podrá tener varios
    Negocio (sedes) más adelante.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=150)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return self.nombre
