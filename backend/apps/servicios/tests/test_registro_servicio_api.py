import datetime

import pytest
from django.utils import timezone

from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db

AYER = (timezone.now() - datetime.timedelta(days=1)).isoformat()
MANANA = (timezone.now() + datetime.timedelta(days=1)).isoformat()


@pytest.fixture
def negocio_con_barbero_y_validador(negocio_con_dueno, servicio_de_prueba, empleado_con):
    negocio, dueno, membresia_dueno = negocio_con_dueno
    barbero, client_barbero = empleado_con(
        negocio=negocio, email="barbero@test.com", nombre="Barbero"
    )
    validador, client_validador = empleado_con(
        negocio=negocio,
        email="validador@test.com",
        nombre="Validador",
        capacidades=["puede_aprobar_servicios"],
    )
    return {
        "negocio": negocio,
        "servicio": servicio_de_prueba,
        "barbero": barbero,
        "client_barbero": client_barbero,
        "validador": validador,
        "client_validador": client_validador,
    }


def test_barbero_registra_su_propio_servicio(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador

    respuesta = ctx["client_barbero"].post(
        "/api/servicios/registros/",
        {
            "servicio": ctx["servicio"].id,
            "nombre_cliente": "Cliente Walk-in",
            "fecha_hora": AYER,
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["estado"] == "pendiente"
    assert respuesta.data["empleado"] == ctx["barbero"].id


def test_no_puede_registrar_a_nombre_de_otro_empleado(negocio_con_barbero_y_validador):
    """El body no acepta `empleado`: siempre sale de la membresía autenticada."""
    ctx = negocio_con_barbero_y_validador

    respuesta = ctx["client_barbero"].post(
        "/api/servicios/registros/",
        {
            "servicio": ctx["servicio"].id,
            "empleado": ctx["validador"].id,
            "nombre_cliente": "Cliente",
            "fecha_hora": AYER,
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["empleado"] == ctx["barbero"].id


def test_administrador_debe_elegir_empleado(negocio_con_barbero_y_validador):
    """Con `puede_aprobar_servicios`, `empleado` deja de ser implícito: si
    no se manda, el request falla — no puede caer en "el validador mismo"
    en silencio."""
    ctx = negocio_con_barbero_y_validador

    respuesta = ctx["client_validador"].post(
        "/api/servicios/registros/",
        {"servicio": ctx["servicio"].id, "nombre_cliente": "Cliente", "fecha_hora": AYER},
        format="json",
    )

    assert respuesta.status_code == 400
    assert "empleado" in respuesta.data


def test_administrador_registra_a_nombre_de_un_barbero(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador

    respuesta = ctx["client_validador"].post(
        "/api/servicios/registros/",
        {
            "servicio": ctx["servicio"].id,
            "empleado": ctx["barbero"].id,
            "nombre_cliente": "Cliente",
            "fecha_hora": AYER,
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["empleado"] == ctx["barbero"].id


def test_administrador_no_puede_elegir_empleado_de_otro_negocio(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    _otro_negocio, _otro_dueno, otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otro-dueno@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Otro Dueño",
    )

    respuesta = ctx["client_validador"].post(
        "/api/servicios/registros/",
        {
            "servicio": ctx["servicio"].id,
            "empleado": otra_membresia.id,
            "nombre_cliente": "Cliente",
            "fecha_hora": AYER,
        },
        format="json",
    )

    assert respuesta.status_code == 400


def test_administrador_no_puede_elegir_empleado_inactivo(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    ctx["barbero"].activo = False
    ctx["barbero"].save(update_fields=["activo"])

    respuesta = ctx["client_validador"].post(
        "/api/servicios/registros/",
        {
            "servicio": ctx["servicio"].id,
            "empleado": ctx["barbero"].id,
            "nombre_cliente": "Cliente",
            "fecha_hora": AYER,
        },
        format="json",
    )

    assert respuesta.status_code == 400


def test_rechaza_fecha_futura(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador

    respuesta = ctx["client_barbero"].post(
        "/api/servicios/registros/",
        {"servicio": ctx["servicio"].id, "nombre_cliente": "Cliente", "fecha_hora": MANANA},
        format="json",
    )

    assert respuesta.status_code == 400


def test_rechaza_servicio_de_otro_negocio(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    otro_negocio, _otro_dueno, _m = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otro@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Otro Dueño",
    )
    servicio_ajeno = servicios_services.crear_servicio(
        negocio=otro_negocio, nombre="Corte ajeno", precio="10000", duracion_minutos=20
    )

    respuesta = ctx["client_barbero"].post(
        "/api/servicios/registros/",
        {"servicio": servicio_ajeno.id, "nombre_cliente": "Cliente", "fecha_hora": AYER},
        format="json",
    )

    assert respuesta.status_code == 400


# --- Listar: propio vs. todo el negocio ---


def test_sin_la_capacidad_solo_ve_los_propios(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Del barbero", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["validador"], servicio=ctx["servicio"],
        nombre_cliente="Del validador", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_barbero"].get("/api/servicios/registros/")

    assert respuesta.status_code == 200
    nombres = {registro["nombre_cliente"] for registro in respuesta.data}
    assert nombres == {"Del barbero"}


def test_con_la_capacidad_ve_todo_el_negocio(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Del barbero", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_validador"].get("/api/servicios/registros/")

    assert respuesta.status_code == 200
    assert len(respuesta.data) == 1


def test_filtra_por_estado(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Del barbero", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )
    servicios_services.aprobar_registro(registro=registro, revisor=ctx["validador"])

    respuesta = ctx["client_validador"].get("/api/servicios/registros/?estado=pendiente")

    assert respuesta.status_code == 200
    assert respuesta.data == []


def test_filtra_por_rango_de_fechas(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    hoy = timezone.now()
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Hace un mes", fecha_hora=hoy - datetime.timedelta(days=30),
    )
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Ayer", fecha_hora=hoy - datetime.timedelta(days=1),
    )

    desde = (hoy - datetime.timedelta(days=2)).date().isoformat()
    hasta = hoy.date().isoformat()
    respuesta = ctx["client_validador"].get(
        f"/api/servicios/registros/?fecha_desde={desde}&fecha_hasta={hasta}"
    )

    assert respuesta.status_code == 200
    nombres = {registro["nombre_cliente"] for registro in respuesta.data}
    assert nombres == {"Ayer"}


def test_filtra_por_empleado(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Del barbero", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )
    servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["validador"], servicio=ctx["servicio"],
        nombre_cliente="Del validador", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_validador"].get(
        f"/api/servicios/registros/?empleado={ctx['barbero'].id}"
    )

    assert respuesta.status_code == 200
    nombres = {registro["nombre_cliente"] for registro in respuesta.data}
    assert nombres == {"Del barbero"}


# --- Aprobar / rechazar ---


def test_aprobar_requiere_la_capacidad(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_barbero"].post(f"/api/servicios/registros/{registro.id}/aprobar/")

    assert respuesta.status_code == 403


def test_aprobar_ok(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_validador"].post(f"/api/servicios/registros/{registro.id}/aprobar/")

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data["estado"] == "aprobado"
    assert respuesta.data["aprobado_por_nombre"] == "Validador"


def test_rechazar_sin_motivo_falla(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_validador"].post(
        f"/api/servicios/registros/{registro.id}/rechazar/", {}, format="json"
    )

    assert respuesta.status_code == 400


def test_rechazar_con_motivo_ok(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_validador"].post(
        f"/api/servicios/registros/{registro.id}/rechazar/",
        {"motivo": "No hay evidencia suficiente."},
        format="json",
    )

    assert respuesta.status_code == 200, respuesta.data
    assert respuesta.data["estado"] == "rechazado"
    assert respuesta.data["motivo_rechazo"] == "No hay evidencia suficiente."


def test_no_puede_aprobar_su_propio_registro_via_api(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["validador"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_validador"].post(f"/api/servicios/registros/{registro.id}/aprobar/")

    assert respuesta.status_code == 400


def test_no_se_puede_revisar_dos_veces_via_api(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )
    servicios_services.aprobar_registro(registro=registro, revisor=ctx["validador"])

    respuesta = ctx["client_validador"].post(f"/api/servicios/registros/{registro.id}/aprobar/")

    assert respuesta.status_code == 400


def test_un_barbero_no_puede_aprobar_ni_ver_el_registro_ajeno(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["validador"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    respuesta = ctx["client_barbero"].get(f"/api/servicios/registros/{registro.id}/")

    assert respuesta.status_code == 404


# --- Evidencia fotográfica ---


def test_registrar_con_evidencia(negocio_con_barbero_y_validador, imagen_de_prueba, media_temporal):
    ctx = negocio_con_barbero_y_validador

    respuesta = ctx["client_barbero"].post(
        "/api/servicios/registros/",
        {
            "servicio": ctx["servicio"].id,
            "nombre_cliente": "Cliente",
            "fecha_hora": AYER,
            "evidencia": imagen_de_prueba(),
        },
        format="multipart",
    )

    assert respuesta.status_code == 201, respuesta.data
    assert respuesta.data["evidencia"]


# --- Aislamiento entre negocios ---


def test_registro_de_otro_negocio_responde_404(negocio_con_barbero_y_validador):
    ctx = negocio_con_barbero_y_validador
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(days=1),
    )

    _otro_negocio, _otro_dueno, _m = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otro@test.com",
        password_dueno="claveSegura123",
        nombre_dueno="Otro Dueño",
    )
    from rest_framework.test import APIClient

    client_otro = APIClient()
    login = client_otro.post(
        "/api/auth/login/", {"email": "otro@test.com", "password": "claveSegura123"}, format="json"
    )
    client_otro.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    respuesta = client_otro.get(f"/api/servicios/registros/{registro.id}/")

    assert respuesta.status_code == 404
