from django.db import models
from django.utils.text import slugify

from apps.common.models import TenantScopedModel

#: Slugs que ningún negocio puede tomar.
#:
#: El perfil público vive en la raíz del dominio (`turnio.app/mi-barberia`),
#: así que el slug comparte espacio de nombres con las rutas de la app. Sin
#: esta lista, un negocio llamado "Agenda" se quedaría con `turnio.app/agenda`
#: y taparía la pantalla del staff — o peor, `/login`.
#:
#: Se incluyen también nombres que todavía no se usan pero son evidentes
#: (`ayuda`, `precios`, `blog`): liberarlos después es trivial, recuperar uno
#: ya tomado por un negocio real significa cambiarle la URL a alguien que
#: quizá ya la repartió.
SLUGS_RESERVADOS = frozenset(
    {
        # Rutas del staff que existen hoy
        "login",
        "registro",
        "agenda",
        "servicios",
        "empleados",
        "configuracion",
        # Superficie pública planeada
        "buscar",
        "negocios",
        "reservar",
        "cita",
        "citas",
        # Infraestructura
        "api",
        "admin",
        "static",
        "media",
        "assets",
        "health",
        # Institucionales, casi seguros a futuro
        "ayuda",
        "soporte",
        "precios",
        "planes",
        "blog",
        "terminos",
        "privacidad",
        "contacto",
        "app",
        "www",
    }
)


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
        # Un nombre de puros símbolos ("+++") deja `slugify` en cadena vacía,
        # y un slug vacío haría que el perfil público fuera la raíz del sitio.
        base = slugify(self.nombre) or "negocio"
        slug = base
        contador = 1
        while self._slug_ocupado(slug):
            contador += 1
            slug = f"{base}-{contador}"
        return slug

    def _slug_ocupado(self, slug):
        if slug in SLUGS_RESERVADOS:
            return True
        return Negocio.objects.filter(slug=slug).exclude(pk=self.pk).exists()
