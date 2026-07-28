"""`PerfilPublicoShellView`: la cáscara HTML con meta tags reales.

No depende de que `frontend/dist/` exista de verdad — apunta
`views_shell._DIST_INDEX` a un `index.html` de prueba, así el test es
determinista sin importar si se corrió `npm run build`.
"""

import pytest
from django.test import Client

from apps.negocios import services as negocios_services
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


def test_sin_index_html_compilado_responde_404_en_vez_de_reventar(cliente, tmp_path, monkeypatch):
    """`frontend/dist/` sin construir no debe tumbar el servidor con un 500."""
    monkeypatch.setattr(views_shell, "_DIST_INDEX", tmp_path / "no-existe.html")
    negocio = _crear_negocio()

    respuesta = cliente.get(f"/{negocio.slug}/")

    assert respuesta.status_code == 404


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
