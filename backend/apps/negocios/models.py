from pathlib import Path
from uuid import uuid4

from django.db import models
from django.utils.text import slugify

from apps.common.models import TenantScopedModel

#: Cuántas fotos puede tener la galería de un negocio (decisión del
#: humano, 2026-07-28). Diez alcanza para mostrar el local y algunos
#: trabajos; más que eso convierte el perfil en un álbum que nadie mira y
#: que hay que descargar por 4G antes de poder reservar, que es lo único
#: que el cliente vino a hacer.
MAX_FOTOS_POR_NEGOCIO = 10

#: Peso máximo por imagen (logo o foto). Cinco megas cubren una foto de
#: celular sin comprimir; por encima de eso es casi seguro que el archivo
#: no pasó por ninguna app y el perfil público se volvería lentísimo.
PESO_MAXIMO_IMAGEN_BYTES = 5 * 1024 * 1024


def _ruta_imagen(carpeta, nombre_archivo):
    """`negocios/<id>/<carpeta>/<aleatorio><.ext>`.

    El nombre original se descarta a propósito: viene de internet (aunque
    sea de un usuario autenticado) y `FileField` lo usaría tal cual para
    escribir en disco. Además, un nombre aleatorio evita que reemplazar el
    logo deje al navegador —o a la CDN, o al crawler de WhatsApp—
    sirviendo el archivo viejo por el mismo path.
    """
    extension = Path(nombre_archivo).suffix.lower()
    return f"{carpeta}/{uuid4().hex}{extension}"


def ruta_logo(instancia, nombre_archivo):
    return _ruta_imagen(f"negocios/{instancia.pk}/logo", nombre_archivo)


def ruta_foto(instancia, nombre_archivo):
    return _ruta_imagen(f"negocios/{instancia.negocio_id}/fotos", nombre_archivo)

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
    # Sin `null=True`: en un campo de archivo Django representa "no hay
    # imagen" con la cadena vacía, y admitir además NULL daría dos formas
    # de decir lo mismo (recomendación explícita de la documentación de
    # Django para campos basados en cadenas).
    logo = models.ImageField(upload_to=ruta_logo, blank=True)
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


class FotoNegocio(TenantScopedModel):
    """Una foto de la galería del perfil público.

    Modelo aparte y no un segundo `ImageField` en `Negocio` porque la
    galería es una lista ordenada de largo variable: el dueño sube el
    local, dos cortes y la vitrina, y después los reordena para que el
    mejor quede primero. `orden` es lo que decide qué se ve primero en el
    carrusel, no la fecha de subida.

    El logo **no** vive acá: es uno solo, tiene un rol distinto (identidad
    del negocio, `og:image` al compartir el enlace) y se pide en sitios
    donde una galería no sirve.
    """

    negocio = models.ForeignKey(Negocio, related_name="fotos", on_delete=models.CASCADE)
    imagen = models.ImageField(upload_to=ruta_foto)
    orden = models.PositiveIntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        # `id` como desempate deja el orden estable cuando varias fotos
        # comparten `orden` (recién subidas, todas en 0): sin él, Postgres
        # puede devolverlas en cualquier orden y el carrusel del perfil
        # público bailaría entre requests.
        ordering = ["orden", "id"]

    def __str__(self):
        return f"Foto de {self.negocio.nombre} (#{self.orden})"
