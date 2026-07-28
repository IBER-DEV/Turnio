"""`PerfilPublicoShellView`: la cáscara HTML con meta tags reales.

No depende de que `frontend/dist/` exista de verdad — apunta
`views_shell._DIST_INDEX` a un `index.html` de prueba, así el test es
determinista sin importar si se corrió `npm run build`.
"""

import pytest
from django.test import Client

from apps.negocios import services as negocios_services
from apps.negocios.models import SLUGS_RESERVADOS
from apps.publico import views_shell

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"

_INDEX_DE_PRUEBA = """<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Turnio</title>
    <script type="module" src="/assets/index-abc123.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
"""


@pytest.fixture
def dist_index(tmp_path, monkeypatch):
    """Sustituye el `index.html` que lee la vista por uno de prueba."""
    archivo = tmp_path / "index.html"
    archivo.write_text(_INDEX_DE_PRUEBA, encoding="utf-8")
    monkeypatch.setattr(views_shell, "_DIST_INDEX", archivo)
    return archivo


@pytest.fixture
def cliente():
    return Client()


def _crear_negocio(**overrides):
    datos = {
        "nombre_negocio": "Barbería Castro",
        "email_dueno": "castro@test.com",
        "password_dueno": PASSWORD,
        "nombre_dueno": "Dueño",
        "ciudad": "Medellín",
        "direccion": "Cra 1 #2-3",
        "telefono": "3001112233",
    }
    datos.update(overrides)
    negocio, _dueno, _m = negocios_services.registrar_negocio(**datos)
    return negocio


def test_incluye_nombre_y_ciudad_del_negocio_en_las_meta_tags(cliente, dist_index):
    negocio = _crear_negocio()

    respuesta = cliente.get(f"/{negocio.slug}/")

    assert respuesta.status_code == 200
    html = respuesta.content.decode("utf-8")
    assert "Barbería Castro" in html
    assert 'property="og:title"' in html
    assert 'property="og:description"' in html
    assert "Medellín" in html
    assert f'property="og:url" content="http://testserver/{negocio.slug}/"' in html


def test_conserva_el_resto_del_shell_compilado(cliente, dist_index):
    """No reescribe el HTML entero: React sigue teniendo dónde montar."""
    negocio = _crear_negocio()

    respuesta = cliente.get(f"/{negocio.slug}/")

    html = respuesta.content.decode("utf-8")
    assert '<div id="root"></div>' in html
    assert '/assets/index-abc123.js' in html


def test_negocio_inactivo_responde_404(cliente, dist_index):
    negocio = _crear_negocio()
    negocio.activo = False
    negocio.save(update_fields=["activo"])

    respuesta = cliente.get(f"/{negocio.slug}/")

    assert respuesta.status_code == 404


def test_slug_inexistente_responde_404(cliente, dist_index):
    respuesta = cliente.get("/este-negocio-no-existe/")

    assert respuesta.status_code == 404


def test_una_ruta_reservada_del_spa_sirve_el_shell_generico_en_vez_de_404(cliente, dist_index):
    """`/login/`, `/agenda/`, etc. nunca son un negocio (ver
    `SLUGS_RESERVADOS`): si Django termina siendo el único origen en
    producción, refrescar ahí no debe romperse."""
    assert "login" in SLUGS_RESERVADOS

    respuesta = cliente.get("/login/")

    assert respuesta.status_code == 200
    html = respuesta.content.decode("utf-8")
    assert '<div id="root"></div>' in html
    # Sin meta tags de negocio: es el shell genérico, no un perfil.
    assert 'property="og:title"' not in html


def test_sin_index_html_compilado_responde_404_en_vez_de_reventar(cliente, tmp_path, monkeypatch):
    """`frontend/dist/` sin construir no debe tumbar el servidor con un 500."""
    monkeypatch.setattr(views_shell, "_DIST_INDEX", tmp_path / "no-existe.html")
    negocio = _crear_negocio()

    respuesta = cliente.get(f"/{negocio.slug}/")

    assert respuesta.status_code == 404


def test_sin_logo_ni_fotos_no_hay_og_image(cliente, dist_index):
    """Un negocio recién registrado no tiene imágenes: el preview sale sin
    foto, no con una etiqueta vacía que deje la tarjeta rota."""
    negocio = _crear_negocio()

    respuesta = cliente.get(f"/{negocio.slug}/")

    html = respuesta.content.decode("utf-8")
    assert 'property="og:image"' not in html
    assert 'name="twitter:card" content="summary"' in html


def test_el_logo_se_convierte_en_og_image_absoluto(
    cliente, dist_index, imagen_de_prueba, media_temporal
):
    """El objetivo de toda esta tanda: que compartir el enlace por WhatsApp
    muestre la imagen del negocio. La URL debe ser absoluta — el crawler
    lee el HTML sin contexto de dominio."""
    negocio = _crear_negocio()
    negocio.logo = imagen_de_prueba("logo.png")
    negocio.save(update_fields=["logo"])

    respuesta = cliente.get(f"/{negocio.slug}/")

    html = respuesta.content.decode("utf-8")
    assert f'property="og:image" content="http://testserver{negocio.logo.url}"' in html
    assert 'name="twitter:card" content="summary_large_image"' in html
    assert f'property="og:image:alt" content="{negocio.nombre}"' in html


def test_sin_logo_usa_la_primera_foto_de_la_galeria(
    cliente, dist_index, imagen_de_prueba, media_temporal
):
    """Quien subió fotos del local pero no un logo igual merece un preview
    con imagen; la primera de la galería es la que el dueño puso primero."""
    negocio = _crear_negocio()
    segunda = negocios_services.agregar_foto(
        negocio=negocio, imagen=imagen_de_prueba("2.png")
    )
    primera = negocios_services.agregar_foto(
        negocio=negocio, imagen=imagen_de_prueba("1.png")
    )
    negocios_services.reordenar_fotos(negocio=negocio, ids=[primera.pk, segunda.pk])

    respuesta = cliente.get(f"/{negocio.slug}/")

    html = respuesta.content.decode("utf-8")
    assert f'property="og:image" content="http://testserver{primera.imagen.url}"' in html


def test_el_nombre_del_negocio_no_puede_inyectar_html(cliente, dist_index):
    """El dueño elige el nombre de su negocio: es texto de un tercero.

    Sin escapar, un nombre como `<script>` o `"><img onerror=...>` se
    ejecutaría en el navegador de cualquiera que abra el enlace — y este
    endpoint es, por diseño, la página más compartida del producto.
    """
    negocio = _crear_negocio(nombre_negocio='Barbería "><script>alert(1)</script>')

    respuesta = cliente.get(f"/{negocio.slug}/")

    html = respuesta.content.decode("utf-8")
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html
