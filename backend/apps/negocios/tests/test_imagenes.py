"""Ficha del negocio, logo y galería de fotos.

Todo lo de acá escribe archivos, así que el módulo entero corre contra un
`MEDIA_ROOT` temporal (`media_temporal`, en `conftest.py`, aplicado como
autouse más abajo).
"""

import os
from io import BytesIO
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.negocios import services
from apps.negocios.models import MAX_FOTOS_POR_NEGOCIO, PESO_MAXIMO_IMAGEN_BYTES

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"


@pytest.fixture(autouse=True)
def _media_aislada(media_temporal):
    """Todos los tests de este módulo suben archivos: nadie debe olvidarse
    de pedir el `MEDIA_ROOT` temporal."""
    return media_temporal


def imagen_pesada():
    """Una imagen válida por encima del límite de peso.

    Ruido y no un color plano: un PNG de 1400×1400 de un solo color pesa
    unos pocos KB por la compresión, y lo que este test necesita es
    justamente un archivo grande de verdad.
    """
    lado = 1400
    crudo = Image.frombytes("RGB", (lado, lado), os.urandom(lado * lado * 3))
    buffer = BytesIO()
    crudo.save(buffer, format="PNG")
    contenido = buffer.getvalue()
    assert len(contenido) > PESO_MAXIMO_IMAGEN_BYTES, "la imagen de prueba no quedó pesada"
    return SimpleUploadedFile("pesada.png", contenido, content_type="image/png")


@pytest.fixture
def negocio_y_dueno(db):
    negocio, dueno, membresia = services.registrar_negocio(
        nombre_negocio="Barbería Imagen",
        email_dueno="dueno@imagen.test",
        password_dueno=PASSWORD,
        nombre_dueno="Dueño",
        ciudad="Cali",
    )
    return negocio, dueno, membresia


@pytest.fixture
def cliente_dueno(negocio_y_dueno):
    _negocio, dueno, _membresia = negocio_y_dueno
    client = APIClient()
    respuesta = client.post(
        "/api/auth/login/", {"email": dueno.email, "password": PASSWORD}, format="json"
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
    return client


# --- La ficha del negocio -------------------------------------------------


def test_cualquier_miembro_puede_ver_la_ficha_de_su_negocio(negocio_y_dueno, empleado_con):
    negocio, _dueno, _m = negocio_y_dueno
    _membresia, client = empleado_con(
        negocio=negocio, email="barbero@imagen.test", capacidades=[]
    )

    respuesta = client.get("/api/negocios/mi-negocio/")

    assert respuesta.status_code == 200
    assert respuesta.data["nombre"] == "Barbería Imagen"
    assert respuesta.data["logo"] is None


def test_editar_la_ficha_exige_puede_editar_negocio(negocio_y_dueno, empleado_con):
    negocio, _dueno, _m = negocio_y_dueno
    _membresia, client = empleado_con(
        negocio=negocio,
        email="recepcion@imagen.test",
        # Deliberadamente alguien con capacidades vecinas: gestionar el
        # equipo o poner precios no debe alcanzar para renombrar el local.
        capacidades=["puede_gestionar_empleados", "puede_editar_precios"],
    )

    respuesta = client.patch(
        "/api/negocios/mi-negocio/", {"nombre": "Nombre robado"}, format="json"
    )

    assert respuesta.status_code == 403
    negocio.refresh_from_db()
    assert negocio.nombre == "Barbería Imagen"


def test_el_dueno_edita_nombre_direccion_y_telefono(cliente_dueno, negocio_y_dueno):
    negocio, _dueno, _m = negocio_y_dueno

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/",
        {"nombre": "Barbería Nueva", "direccion": "Calle 5 #10-20", "telefono": "3009998877"},
        format="json",
    )

    assert respuesta.status_code == 200
    negocio.refresh_from_db()
    assert negocio.nombre == "Barbería Nueva"
    assert negocio.direccion == "Calle 5 #10-20"
    assert negocio.telefono == "3009998877"


def test_el_slug_no_se_puede_cambiar(cliente_dueno, negocio_y_dueno):
    """Es el enlace que el dueño ya repartió: cambiarlo rompe en silencio
    todo lo que él mismo compartió."""
    negocio, _dueno, _m = negocio_y_dueno
    slug_original = negocio.slug

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"slug": "otro-slug"}, format="json"
    )

    assert respuesta.status_code == 200
    negocio.refresh_from_db()
    assert negocio.slug == slug_original


def test_subir_el_logo_lo_deja_guardado_y_con_url_absoluta(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": imagen_de_prueba()}, format="multipart"
    )

    assert respuesta.status_code == 200
    assert respuesta.data["logo"].startswith("http://testserver/media/")
    negocio.refresh_from_db()
    assert negocio.logo.name.startswith(f"negocios/{negocio.pk}/logo/")
    assert Path(negocio.logo.path).exists()


def test_reemplazar_el_logo_borra_el_archivo_anterior(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    """Django no borra el archivo viejo por su cuenta: sin esto,
    `MEDIA_ROOT` acumularía un logo muerto por cada cambio."""
    negocio, _dueno, _m = negocio_y_dueno
    cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": imagen_de_prueba()}, format="multipart"
    )
    negocio.refresh_from_db()
    anterior = Path(negocio.logo.path)

    cliente_dueno.patch(
        "/api/negocios/mi-negocio/",
        {"logo": imagen_de_prueba("otro.png", "blue")},
        format="multipart",
    )

    negocio.refresh_from_db()
    assert Path(negocio.logo.path) != anterior
    assert not anterior.exists()
    assert Path(negocio.logo.path).exists()


def test_mandar_el_logo_vacio_lo_quita(cliente_dueno, negocio_y_dueno, imagen_de_prueba):
    negocio, _dueno, _m = negocio_y_dueno
    cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": imagen_de_prueba()}, format="multipart"
    )

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": ""}, format="multipart"
    )

    assert respuesta.status_code == 200
    assert respuesta.data["logo"] is None
    negocio.refresh_from_db()
    assert negocio.logo.name == ""


def test_un_archivo_que_no_es_imagen_se_rechaza(cliente_dueno):
    falso = SimpleUploadedFile(
        "virus.png", b"MZ esto no es una imagen", content_type="image/png"
    )

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": falso}, format="multipart"
    )

    assert respuesta.status_code == 400
    assert "logo" in respuesta.data


def test_una_imagen_demasiado_pesada_se_rechaza(cliente_dueno):
    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": imagen_pesada()}, format="multipart"
    )

    assert respuesta.status_code == 400
    assert "logo" in respuesta.data


# --- Tema, color y portada ------------------------------------------------


def test_el_dueno_elige_tema_y_color_de_acento(cliente_dueno, negocio_y_dueno):
    negocio, _dueno, _m = negocio_y_dueno

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/",
        {"tema": "vitrina", "color_acento": "#ff5733"},
        format="json",
    )

    assert respuesta.status_code == 200
    negocio.refresh_from_db()
    assert negocio.tema == "vitrina"
    assert negocio.color_acento == "#ff5733"


def test_un_color_que_no_es_hex_se_rechaza(cliente_dueno, negocio_y_dueno):
    """Este valor termina inyectado en una variable CSS del perfil
    público: una cadena arbitraria no es un dato feo, es una vía de
    entrada a la hoja de estilos de una página abierta a internet."""
    negocio, _dueno, _m = negocio_y_dueno

    for valor in ["rojo", "#12345", "javascript:alert(1)", "#12345g", "red; }"]:
        respuesta = cliente_dueno.patch(
            "/api/negocios/mi-negocio/", {"color_acento": valor}, format="json"
        )
        assert respuesta.status_code == 400, valor

    negocio.refresh_from_db()
    assert negocio.color_acento == ""


def test_el_color_vacio_es_valido_y_significa_el_de_turnio(cliente_dueno, negocio_y_dueno):
    negocio, _dueno, _m = negocio_y_dueno
    negocio.color_acento = "#ff5733"
    negocio.save(update_fields=["color_acento"])

    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"color_acento": ""}, format="json"
    )

    assert respuesta.status_code == 200
    negocio.refresh_from_db()
    assert negocio.color_acento == ""


def test_un_tema_inventado_se_rechaza(cliente_dueno):
    respuesta = cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"tema": "el-mio-propio"}, format="json"
    )

    assert respuesta.status_code == 400


def test_la_portada_se_sube_y_reemplazarla_borra_la_anterior(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno

    cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"portada": imagen_de_prueba()}, format="multipart"
    )
    negocio.refresh_from_db()
    anterior = Path(negocio.portada.path)
    assert anterior.exists()

    cliente_dueno.patch(
        "/api/negocios/mi-negocio/",
        {"portada": imagen_de_prueba("otra.png", "blue")},
        format="multipart",
    )

    negocio.refresh_from_db()
    assert not anterior.exists()
    assert Path(negocio.portada.path).exists()


def test_cambiar_la_portada_no_toca_el_logo(cliente_dueno, negocio_y_dueno, imagen_de_prueba):
    """El barrido de archivos viejos recorre los dos campos de imagen:
    conviene fijar que no se lleve por delante el que no cambió."""
    negocio, _dueno, _m = negocio_y_dueno
    cliente_dueno.patch(
        "/api/negocios/mi-negocio/", {"logo": imagen_de_prueba("logo.png")}, format="multipart"
    )
    negocio.refresh_from_db()
    logo = Path(negocio.logo.path)

    cliente_dueno.patch(
        "/api/negocios/mi-negocio/",
        {"portada": imagen_de_prueba("portada.png", "blue")},
        format="multipart",
    )

    negocio.refresh_from_db()
    assert logo.exists()
    assert negocio.logo.name != ""


# --- La galería -----------------------------------------------------------


def test_subir_una_foto_la_agrega_al_final_de_la_galeria(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno

    primera = cliente_dueno.post(
        "/api/negocios/mi-negocio/fotos/",
        {"imagen": imagen_de_prueba("1.png")},
        format="multipart",
    )
    segunda = cliente_dueno.post(
        "/api/negocios/mi-negocio/fotos/",
        {"imagen": imagen_de_prueba("2.png")},
        format="multipart",
    )

    assert primera.status_code == 201
    assert segunda.status_code == 201
    assert primera.data["orden"] == 0
    assert segunda.data["orden"] == 1
    assert segunda.data["imagen"].startswith("http://testserver/media/")
    assert negocio.fotos.count() == 2


def test_subir_fotos_exige_puede_editar_negocio(
    negocio_y_dueno, empleado_con, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno
    _membresia, client = empleado_con(
        negocio=negocio, email="otro@imagen.test", capacidades=["puede_gestionar_empleados"]
    )

    respuesta = client.post(
        "/api/negocios/mi-negocio/fotos/", {"imagen": imagen_de_prueba()}, format="multipart"
    )

    assert respuesta.status_code == 403
    assert negocio.fotos.count() == 0


def test_la_galeria_tiene_tope_de_fotos(cliente_dueno, negocio_y_dueno, imagen_de_prueba):
    negocio, _dueno, _m = negocio_y_dueno
    for numero in range(MAX_FOTOS_POR_NEGOCIO):
        services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba(f"{numero}.png"))

    respuesta = cliente_dueno.post(
        "/api/negocios/mi-negocio/fotos/",
        {"imagen": imagen_de_prueba("extra.png")},
        format="multipart",
    )

    assert respuesta.status_code == 400
    assert negocio.fotos.count() == MAX_FOTOS_POR_NEGOCIO


def test_borrar_una_foto_borra_tambien_el_archivo(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno
    foto = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba())
    ruta = Path(foto.imagen.path)
    assert ruta.exists()

    respuesta = cliente_dueno.delete(f"/api/negocios/mi-negocio/fotos/{foto.pk}/")

    assert respuesta.status_code == 204
    assert negocio.fotos.count() == 0
    assert not ruta.exists()


def test_no_se_puede_borrar_la_foto_de_otro_negocio(cliente_dueno, imagen_de_prueba):
    """Un recurso ajeno responde 404, igual que uno inexistente
    (`CONTRATO.md` 5.2)."""
    ajeno, _dueno, _m = services.registrar_negocio(
        nombre_negocio="Salón Ajeno",
        email_dueno="ajeno@imagen.test",
        password_dueno=PASSWORD,
        nombre_dueno="Ajeno",
    )
    foto_ajena = services.agregar_foto(negocio=ajeno, imagen=imagen_de_prueba())

    respuesta = cliente_dueno.delete(f"/api/negocios/mi-negocio/fotos/{foto_ajena.pk}/")

    assert respuesta.status_code == 404
    assert ajeno.fotos.count() == 1


def test_la_galeria_solo_lista_las_fotos_del_negocio_propio(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno
    ajeno, _d, _m2 = services.registrar_negocio(
        nombre_negocio="Salón Ajeno",
        email_dueno="ajeno2@imagen.test",
        password_dueno=PASSWORD,
        nombre_dueno="Ajeno",
    )
    services.agregar_foto(negocio=ajeno, imagen=imagen_de_prueba("ajena.png"))
    propia = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("propia.png"))

    respuesta = cliente_dueno.get("/api/negocios/mi-negocio/fotos/")

    assert respuesta.status_code == 200
    assert [foto["id"] for foto in respuesta.data] == [propia.pk]


def test_reordenar_fija_el_orden_del_carrusel(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno
    primera = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("1.png"))
    segunda = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("2.png"))
    tercera = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("3.png"))

    respuesta = cliente_dueno.put(
        "/api/negocios/mi-negocio/fotos/orden/",
        {"ids": [tercera.pk, primera.pk, segunda.pk]},
        format="json",
    )

    assert respuesta.status_code == 200
    assert [foto["id"] for foto in respuesta.data] == [tercera.pk, primera.pk, segunda.pk]
    assert list(negocio.fotos.values_list("id", flat=True)) == [
        tercera.pk,
        primera.pk,
        segunda.pk,
    ]


def test_reordenar_con_una_lista_incompleta_se_rechaza(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    """El orden es del conjunto: con una lista parcial habría que inventar
    dónde caen las fotos que faltan."""
    negocio, _dueno, _m = negocio_y_dueno
    primera = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("1.png"))
    services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("2.png"))

    respuesta = cliente_dueno.put(
        "/api/negocios/mi-negocio/fotos/orden/", {"ids": [primera.pk]}, format="json"
    )

    assert respuesta.status_code == 400
    assert "ids" in respuesta.data


def test_reordenar_no_acepta_fotos_de_otro_negocio(
    cliente_dueno, negocio_y_dueno, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno
    propia = services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba("propia.png"))
    ajeno, _d, _m2 = services.registrar_negocio(
        nombre_negocio="Salón Ajeno",
        email_dueno="ajeno3@imagen.test",
        password_dueno=PASSWORD,
        nombre_dueno="Ajeno",
    )
    ajena = services.agregar_foto(negocio=ajeno, imagen=imagen_de_prueba("ajena.png"))

    respuesta = cliente_dueno.put(
        "/api/negocios/mi-negocio/fotos/orden/",
        {"ids": [propia.pk, ajena.pk]},
        format="json",
    )

    assert respuesta.status_code == 400
    ajena.refresh_from_db()
    assert ajena.orden == 0


def test_reordenar_exige_puede_editar_negocio(
    negocio_y_dueno, empleado_con, imagen_de_prueba
):
    negocio, _dueno, _m = negocio_y_dueno
    services.agregar_foto(negocio=negocio, imagen=imagen_de_prueba())
    _membresia, client = empleado_con(
        negocio=negocio, email="sinpermiso@imagen.test", capacidades=[]
    )

    respuesta = client.put(
        "/api/negocios/mi-negocio/fotos/orden/", {"ids": []}, format="json"
    )

    assert respuesta.status_code == 403
