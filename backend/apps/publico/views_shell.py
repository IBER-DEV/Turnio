"""La cáscara HTML del perfil público — la única vista de este proyecto
que no es DRF, y por qué hace falta.

Todo lo demás en `apps.publico` es una API: JSON puro, consumido por el
SPA de React (`frontend/`) que Vite compila a un `index.html` genérico.
Eso funciona para un navegador, pero no para quien **comparte** el
enlace: los crawlers de WhatsApp, Instagram y Facebook leen el HTML
crudo de la respuesta y no ejecutan JavaScript. Pegar
`turnio.app/barberia-elite` en un chat mostraría la vista previa
"Turnio", sin nombre, sin ciudad, igual para cualquier negocio — el
enlace que el dueño puso en su bio de Instagram se vería roto, y ese
enlace es exactamente el reemplazo de "escríbeme por WhatsApp" que
Fase 2 existe para ofrecer.

Esta vista intercepta `/{slug}/` en el servidor, antes de que React
monte, e inyecta las meta tags Open Graph con los datos reales del
negocio en el `index.html` que ya produjo `npm run build`. No reemplaza
`PerfilNegocioPage` ni duplica su UI: React sigue montando exactamente
igual después, esta vista solo le da al crawler (y a la primera pintura
del navegador) una respuesta que ya dice de qué negocio se trata.

**Requiere `frontend/dist/` compilado** (`npm run build`). No se genera
sola: si no existe, esta vista no tiene qué servir. Ver
`ROADMAP-BACKEND.md` para el estado de cómo se sirve `frontend/dist/`
fuera de desarrollo — hoy no hay pipeline de despliegue en el repo, así
que esa parte queda pendiente a propósito.

También cubre las rutas del propio SPA (`/login`, `/agenda`, …): como
comparten espacio de nombres con los slugs (`SLUGS_RESERVADOS`), esta
vista responde con el shell genérico para esas en vez de 404 — necesario
para que refrescar la página en una ruta de React Router no rompa si
Django termina siendo el único origen.
"""

from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse
from django.utils.html import escape
from django.views import View

from apps.negocios.models import SLUGS_RESERVADOS, Negocio

_DIST_INDEX = Path(settings.BASE_DIR).parent / "frontend" / "dist" / "index.html"


def _shell_html() -> str:
    # Se relee en cada request en vez de cachearse en el import: el
    # archivo cambia cada vez que se corre `npm run build`, y no vale la
    # pena versionar cuándo invalidar un caché en memoria por un read()
    # de unos pocos KB.
    if not _DIST_INDEX.exists():
        raise Http404(
            "frontend/dist/index.html no existe. Corre `npm run build` en "
            "frontend/ antes de visitar el perfil público."
        )
    return _DIST_INDEX.read_text(encoding="utf-8")


class PerfilPublicoShellView(View):
    """`GET /{slug}/` — el perfil público, con meta tags reales.

    Reglas heredadas de `apps.publico.views` (misma superficie, mismo
    contrato): solo negocios `activo=True`; uno inactivo responde 404 en
    vez de mostrar un perfil desactualizado.
    """

    def get(self, request, slug):
        # `login`, `agenda`, etc. son rutas del SPA, no negocios — nunca
        # podrán existir como slug (`Negocio._slug_ocupado` las bloquea
        # al crear). Servir acá el shell genérico (sin meta tags) es lo
        # que permite refrescar `/login` o entrar por URL directa sin
        # pasar por Vite: sin esto, Django (si termina siendo el único
        # origen en producción) respondería 404 en cualquier ruta del
        # SPA que no sea `/`. React Router decide desde ahí si la ruta
        # existe de verdad.
        if slug in SLUGS_RESERVADOS:
            return HttpResponse(_shell_html(), content_type="text/html; charset=utf-8")

        negocio = Negocio.objects.filter(slug=slug, activo=True).first()
        if negocio is None:
            raise Http404("Negocio no encontrado.")

        titulo = f"{negocio.nombre} · Reserva tu cita en Turnio"
        descripcion = (
            f"Reserva en línea en {negocio.nombre}, {negocio.ciudad}. "
            "Elige servicio, profesional y hora — sin llamar ni escribir "
            "por WhatsApp."
        )
        url = request.build_absolute_uri(f"/{slug}/")

        # La imagen del preview: el logo si el negocio subió uno, si no la
        # primera foto de su galería. Un negocio sin ninguna de las dos se
        # comparte sin imagen, como antes — un preview sin imagen es peor
        # que uno con la foto del local, pero mejor que uno idéntico para
        # los 200 negocios de la plataforma.
        #
        # La URL tiene que ser **absoluta**: `ImageField.url` es un path
        # relativo (`/media/...`) y el crawler de WhatsApp lee el HTML sin
        # contexto de dominio. Mismo `build_absolute_uri` que ya se usa
        # arriba para `og:url`.
        imagen = negocio.logo if negocio.logo else None
        if imagen is None:
            primera_foto = negocio.fotos.first()
            imagen = primera_foto.imagen if primera_foto else None
        url_imagen = request.build_absolute_uri(imagen.url) if imagen else None

        og_tags = (
            f'<meta property="og:type" content="business.business">\n'
            f'    <meta property="og:title" content="{escape(titulo)}">\n'
            f'    <meta property="og:description" content="{escape(descripcion)}">\n'
            f'    <meta property="og:url" content="{escape(url)}">\n'
        )
        if url_imagen:
            # `summary_large_image` solo cuando hay imagen: con `summary`
            # a secas, Twitter/X la muestra como miniatura cuadrada, y sin
            # imagen la variante grande deja una tarjeta vacía.
            og_tags += (
                f'    <meta property="og:image" content="{escape(url_imagen)}">\n'
                f'    <meta property="og:image:alt" content="{escape(negocio.nombre)}">\n'
                f'    <meta name="twitter:card" content="summary_large_image">\n'
            )
        else:
            og_tags += '    <meta name="twitter:card" content="summary">\n'
        og_tags += f'    <meta name="description" content="{escape(descripcion)}">'

        html = _shell_html()
        # El shell genérico siempre tiene exactamente un `<title>Turnio</title>`
        # (viene de `frontend/index.html`, que no cambia entre builds). Si
        # ese literal deja de existir el reemplazo no aplica y se sirve el
        # shell genérico sin romper — mejor un preview pobre que un 500.
        html = html.replace(
            "<title>Turnio</title>",
            f"<title>{escape(titulo)}</title>\n    {og_tags}",
        )
        return HttpResponse(html, content_type="text/html; charset=utf-8")
