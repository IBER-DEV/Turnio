from django.db import models
from django.utils.text import slugify

from apps.common.models import TenantScopedModel


class Negocio(TenantScopedModel):
    nombre = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    ciudad = models.CharField(max_length=100, blank=True)
    direccion = models.CharField(max_length=255, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return self.nombre

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generar_slug_unico()
        super().save(*args, **kwargs)

    def _generar_slug_unico(self):
        base = slugify(self.nombre)
        slug = base
        contador = 1
        while Negocio.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            contador += 1
            slug = f"{base}-{contador}"
        return slug
