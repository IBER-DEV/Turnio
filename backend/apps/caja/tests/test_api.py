import datetime
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.caja import services
from apps.caja.models import MovimientoCaja
from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"


@pytest.fixture
def negocio_con_cobrador_y_barbero(negocio_con_dueno, servicio_de_prueba, empleado_con):
    """Dueño (todas las capacidades, incluida `puede_cobrar`), un barbero
    sin capacidades, y un validador para poder aprobar servicios sin
    violar "nadie aprueba lo suyo"."""
    negocio, dueno, membresia_dueno = negocio_con_dueno
    servicio_de_prueba.refresh_from_db()
    client_dueno = APIClient()
    respuesta = client_dueno.post(
        "/api/auth/login/", {"email": dueno.email, "password": PASSWORD}, format="json"
    )
    client_dueno.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")

    barbero, client_barbero = empleado_con(negocio=negocio, email="barbero@cajaapi.test", nombre="Barbero")
    validador, client_validador = empleado_con(
        negocio=negocio,
        email="validador@cajaapi.test",
        nombre="Validador",
        capacidades=["puede_aprobar_servicios"],
    )
    sin_capacidades, client_sin_capacidades = empleado_con(
        negocio=negocio, email="raso@cajaapi.test", nombre="Raso"
    )
    return {
        "negocio": negocio,
        "dueno": membresia_dueno,
        "client_dueno": client_dueno,
        "servicio": servicio_de_prueba,
        "barbero": barbero,
        "client_barbero": client_barbero,
        "validador": validador,
        "client_validador": client_validador,
        "client_sin_capacidades": client_sin_capacidades,
    }


def _registro_aprobado(ctx):
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"],
        empleado=ctx["barbero"],
        servicio=ctx["servicio"],
        nombre_cliente="Cliente",
        fecha_hora=timezone.now() - datetime.timedelta(hours=1),
    )
    return servicios_services.aprobar_registro(registro=registro, revisor=ctx["validador"])


# --- Gating por capacidad ---


def test_abrir_requiere_puede_cobrar(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero

    respuesta = ctx["client_sin_capacidades"].post("/api/caja/abrir/", {}, format="json")

    assert respuesta.status_code == 403


def test_movimientos_requiere_puede_cobrar(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_sin_capacidades"].post(
        "/api/caja/movimientos/",
        {"tipo": "ingreso", "metodo_pago": "efectivo", "monto": "10000", "concepto": "x"},
        format="json",
    )

    assert respuesta.status_code == 403


def test_cerrar_requiere_puede_cobrar(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_sin_capacidades"].post("/api/caja/cerrar/", {}, format="json")

    assert respuesta.status_code == 403


def test_listar_historico_falla_sin_puede_cobrar_ni_puede_ver_reportes(
    negocio_con_cobrador_y_barbero,
):
    ctx = negocio_con_cobrador_y_barbero

    respuesta = ctx["client_sin_capacidades"].get("/api/caja/")

    assert respuesta.status_code == 403


def test_listar_historico_alcanza_con_puede_ver_reportes(negocio_con_cobrador_y_barbero, empleado_con):
    ctx = negocio_con_cobrador_y_barbero
    _reportero, client_reportero = empleado_con(
        negocio=ctx["negocio"], email="reportes@cajaapi.test", capacidades=["puede_ver_reportes"]
    )

    respuesta = client_reportero.get("/api/caja/")

    assert respuesta.status_code == 200


# --- /actual/ ---


def test_actual_404_sin_caja_abierta(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero

    respuesta = ctx["client_dueno"].get("/api/caja/actual/")

    assert respuesta.status_code == 404


def test_actual_devuelve_la_caja_abierta(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {"saldo_inicial": "30000"}, format="json")

    respuesta = ctx["client_dueno"].get("/api/caja/actual/")

    assert respuesta.status_code == 200
    assert respuesta.data["estado"] == "abierta"
    assert respuesta.data["saldo_inicial"] == "30000.00"


# --- Flujo E2E ---


def test_flujo_completo_abrir_cobrar_cerrar(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["servicio"].porcentaje_comision = Decimal("70")
    ctx["servicio"].save(update_fields=["porcentaje_comision"])
    registro = _registro_aprobado(ctx)

    apertura = ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")
    assert apertura.status_code == 201

    movimiento = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {
            "tipo": "ingreso",
            "metodo_pago": "nequi",
            "monto": str(ctx["servicio"].precio),
            "concepto": ctx["servicio"].nombre,
            "registro_servicio": registro.id,
        },
        format="json",
    )
    assert movimiento.status_code == 201, movimiento.data
    esperado = (ctx["servicio"].precio * Decimal("70") / Decimal("100")).quantize(Decimal("0.01"))
    assert Decimal(movimiento.data["monto_comision"]) == esperado
    assert movimiento.data["empleado_comision"] == ctx["barbero"].id

    cierre = ctx["client_dueno"].post("/api/caja/cerrar/", {"nota_cierre": "ok"}, format="json")
    assert cierre.status_code == 200
    resumen = cierre.data["resumen"]
    assert Decimal(resumen["total_ingresos"]) == ctx["servicio"].precio
    assert resumen["comisiones_por_empleado"][0]["empleado"] == ctx["barbero"].id
    assert resumen["servicios_aprobados_sin_cobrar"] == 0


def test_no_se_puede_vincular_el_mismo_registro_dos_veces(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    registro = _registro_aprobado(ctx)
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")
    primero = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {
            "tipo": "ingreso",
            "metodo_pago": "efectivo",
            "monto": str(ctx["servicio"].precio),
            "concepto": "Corte",
            "registro_servicio": registro.id,
        },
        format="json",
    )
    assert primero.status_code == 201

    segundo = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {
            "tipo": "ingreso",
            "metodo_pago": "efectivo",
            "monto": str(ctx["servicio"].precio),
            "concepto": "duplicado",
            "registro_servicio": registro.id,
        },
        format="json",
    )

    assert segundo.status_code == 400


def test_no_se_puede_cobrar_un_registro_no_aprobado(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    registro = servicios_services.registrar_servicio(
        negocio=ctx["negocio"], empleado=ctx["barbero"], servicio=ctx["servicio"],
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(hours=1),
    )
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {
            "tipo": "ingreso", "metodo_pago": "efectivo", "monto": "10000",
            "concepto": "x", "registro_servicio": registro.id,
        },
        format="json",
    )

    assert respuesta.status_code == 400


def test_abrir_dos_veces_falla(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    assert respuesta.status_code == 400


def test_movimientos_sin_caja_abierta_falla(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero

    respuesta = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {"tipo": "ingreso", "metodo_pago": "efectivo", "monto": "10000", "concepto": "x"},
        format="json",
    )

    assert respuesta.status_code == 400


def test_egreso_no_acepta_metodo_pago(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {"tipo": "egreso", "metodo_pago": "efectivo", "monto": "5000", "concepto": "Insumos"},
        format="json",
    )

    assert respuesta.status_code == 400
    assert "metodo_pago" in respuesta.data


def test_ingreso_sin_metodo_pago_falla(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {"tipo": "ingreso", "monto": "5000", "concepto": "Corte"},
        format="json",
    )

    assert respuesta.status_code == 400
    assert "metodo_pago" in respuesta.data


# --- Histórico y aislamiento ---


def test_listar_historico_filtra_por_fecha(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")
    ctx["client_dueno"].post("/api/caja/cerrar/", {}, format="json")

    hoy = timezone.localdate().isoformat()
    manana = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()

    respuesta_incluye = ctx["client_dueno"].get(f"/api/caja/?fecha_desde={hoy}&fecha_hasta={hoy}")
    respuesta_excluye = ctx["client_dueno"].get(
        f"/api/caja/?fecha_desde={manana}&fecha_hasta={manana}"
    )

    assert len(respuesta_incluye.data) == 1
    assert len(respuesta_excluye.data) == 0


def test_aislamiento_por_tenant(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    apertura = ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")
    caja_id = apertura.data["id"]

    _otro_negocio, _otro_dueno, _m = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otro-caja@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Otro Dueño",
    )
    client_otro = APIClient()
    login = client_otro.post(
        "/api/auth/login/", {"email": "otro-caja@test.com", "password": PASSWORD}, format="json"
    )
    client_otro.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    respuesta = client_otro.get(f"/api/caja/{caja_id}/")

    assert respuesta.status_code == 404


def test_movimiento_de_negocio_ajeno_se_rechaza(negocio_con_cobrador_y_barbero):
    ctx = negocio_con_cobrador_y_barbero
    otro_negocio, _otro_dueno, _m = negocios_services.registrar_negocio(
        nombre_negocio="Otro Negocio",
        email_dueno="otro-servicio@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Otro Dueño",
    )
    servicio_ajeno = servicios_services.crear_servicio(
        negocio=otro_negocio, nombre="Corte ajeno", precio=Decimal("10000"), duracion_minutos=20
    )
    _usuario_ajeno, empleado_ajeno = negocios_services.agregar_empleado(
        negocio=otro_negocio, email="empleado-ajeno@test.com", password=PASSWORD, nombre="Ajeno"
    )
    registro_ajeno = servicios_services.registrar_servicio(
        negocio=otro_negocio, empleado=empleado_ajeno, servicio=servicio_ajeno,
        nombre_cliente="Cliente", fecha_hora=timezone.now() - datetime.timedelta(hours=1),
    )
    ctx["client_dueno"].post("/api/caja/abrir/", {}, format="json")

    respuesta = ctx["client_dueno"].post(
        "/api/caja/movimientos/",
        {
            "tipo": "ingreso", "metodo_pago": "efectivo", "monto": "10000",
            "concepto": "x", "registro_servicio": registro_ajeno.id,
        },
        format="json",
    )

    assert respuesta.status_code == 400
