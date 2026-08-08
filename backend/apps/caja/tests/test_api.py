from decimal import Decimal

import pytest

from apps.caja import services
from apps.caja.models import MetodoPago, MovimientoCaja, Venta

pytestmark = pytest.mark.django_db


@pytest.fixture
def ctx(negocio_con_dueno, servicio_de_prueba, empleado_con):
    """Dueño (todas las capacidades), un barbero raso, y un cajero que
    cobra pero **no** puede anular."""
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    servicio_de_prueba.porcentaje_comision = Decimal("40")
    servicio_de_prueba.save()
    servicio_de_prueba.refresh_from_db()

    barbero, client_barbero = empleado_con(
        negocio=negocio, email="barbero@api.test", nombre="Barbero"
    )
    cajero, client_cajero = empleado_con(
        negocio=negocio,
        email="cajero@api.test",
        nombre="Cajero",
        capacidades=["puede_cobrar"],
    )
    return {
        "negocio": negocio,
        "dueno": membresia_dueno,
        "servicio": servicio_de_prueba,
        "barbero": barbero,
        "client_barbero": client_barbero,
        "cajero": cajero,
        "client_cajero": client_cajero,
    }


def _crear_venta_api(client, ctx, empleado=None):
    return client.post(
        "/api/caja/ventas/",
        {
            "nombre_cliente": "Juan Pérez",
            "items": [
                {
                    "servicio": ctx["servicio"].id,
                    "empleado": (empleado or ctx["barbero"]).id,
                }
            ],
        },
        format="json",
    )


# --- caja ---


def test_abrir_y_cerrar_con_arqueo(cliente_autenticado_dueno, ctx):
    abrir = cliente_autenticado_dueno.post(
        "/api/caja/abrir/", {"saldo_inicial": "100000"}, format="json"
    )
    assert abrir.status_code == 201

    cerrar = cliente_autenticado_dueno.post(
        "/api/caja/cerrar/", {"efectivo_contado": "98000"}, format="json"
    )

    assert cerrar.status_code == 200
    assert cerrar.data["efectivo_esperado"] == "100000.00"
    assert cerrar.data["diferencia"] == "-2000.00"


def test_cerrar_sin_contar_el_efectivo_falla(cliente_autenticado_dueno, ctx):
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")

    respuesta = cliente_autenticado_dueno.post("/api/caja/cerrar/", {}, format="json")

    assert respuesta.status_code == 400
    assert "efectivo_contado" in respuesta.data


def test_barbero_no_puede_abrir_caja(ctx):
    respuesta = ctx["client_barbero"].post("/api/caja/abrir/", {}, format="json")

    assert respuesta.status_code == 403


def test_egreso_queda_registrado(cliente_autenticado_dueno, ctx):
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")

    respuesta = cliente_autenticado_dueno.post(
        "/api/caja/egresos/",
        {"monto": "50000", "concepto": "Compra de productos", "categoria": "insumos"},
        format="json",
    )

    assert respuesta.status_code == 201
    assert respuesta.data["tipo"] == "egreso"
    assert respuesta.data["categoria"] == "insumos"


def test_egreso_sin_caja_abierta_falla(cliente_autenticado_dueno, ctx):
    respuesta = cliente_autenticado_dueno.post(
        "/api/caja/egresos/",
        {"monto": "50000", "concepto": "Compra", "categoria": "insumos"},
        format="json",
    )

    assert respuesta.status_code == 400


def test_no_existe_endpoint_para_crear_movimientos_sueltos(cliente_autenticado_dueno, ctx):
    """La plata que entra siempre tiene una venta que la explica.

    El viejo `POST /api/caja/movimientos/` era la puerta por la que
    entraba un ingreso sin cuenta detrás. Responde 405 y no 404 porque la
    ruta la absorbe el detalle de caja (`/api/caja/{pk}/`), que solo
    acepta GET — lo que importa es que no haya forma de crear un
    movimiento a mano.
    """
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")

    respuesta = cliente_autenticado_dueno.post(
        "/api/caja/movimientos/",
        {"tipo": "ingreso", "monto": "50000", "concepto": "Lo que sea"},
        format="json",
    )

    assert respuesta.status_code == 405


# --- ventas ---


def test_crear_y_cobrar_venta(cliente_autenticado_dueno, ctx):
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")
    creada = _crear_venta_api(cliente_autenticado_dueno, ctx)
    assert creada.status_code == 201
    assert creada.data["estado"] == "pendiente"
    assert creada.data["total"] == "20000.00"

    cobrada = cliente_autenticado_dueno.post(
        f"/api/caja/ventas/{creada.data['id']}/cobrar/",
        {"monto": "20000", "metodo_pago": "efectivo"},
        format="json",
    )

    assert cobrada.status_code == 200
    assert cobrada.data["estado"] == "pagada"
    assert cobrada.data["saldo_pendiente"] == "0.00"


def test_pago_mixto_son_dos_cobros(cliente_autenticado_dueno, ctx):
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")
    venta_id = _crear_venta_api(cliente_autenticado_dueno, ctx).data["id"]

    primero = cliente_autenticado_dueno.post(
        f"/api/caja/ventas/{venta_id}/cobrar/",
        {"monto": "8000", "metodo_pago": "efectivo"},
        format="json",
    )
    assert primero.data["estado"] == "parcial"

    segundo = cliente_autenticado_dueno.post(
        f"/api/caja/ventas/{venta_id}/cobrar/",
        {"monto": "12000", "metodo_pago": "tarjeta"},
        format="json",
    )

    assert segundo.data["estado"] == "pagada"
    assert len(segundo.data["pagos"]) == 2


def test_cola_de_cobro_lista_solo_pendientes(cliente_autenticado_dueno, ctx):
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")
    pendiente = _crear_venta_api(cliente_autenticado_dueno, ctx).data["id"]
    cobrada = _crear_venta_api(cliente_autenticado_dueno, ctx).data["id"]
    cliente_autenticado_dueno.post(
        f"/api/caja/ventas/{cobrada}/cobrar/",
        {"monto": "20000", "metodo_pago": "efectivo"},
        format="json",
    )

    respuesta = cliente_autenticado_dueno.get("/api/caja/ventas/?estado=pendiente")

    ids = [venta["id"] for venta in respuesta.data]
    assert ids == [pendiente]


def test_barbero_solo_puede_facturar_su_propio_trabajo(ctx):
    """Sin `puede_cobrar`, nadie le carga trabajo (ni comisión) a un
    compañero."""
    respuesta = _crear_venta_api(ctx["client_barbero"], ctx, empleado=ctx["cajero"])

    assert respuesta.status_code == 400
    assert "Solo puedes registrar servicios realizados por ti" in str(respuesta.data)


def test_barbero_no_ve_ventas_ajenas(ctx, cliente_autenticado_dueno):
    """Las ventas traen la libreta de clientes: sin capacidad, solo las
    propias."""
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")
    _crear_venta_api(cliente_autenticado_dueno, ctx, empleado=ctx["cajero"])
    propia = _crear_venta_api(cliente_autenticado_dueno, ctx, empleado=ctx["barbero"])

    respuesta = ctx["client_barbero"].get("/api/caja/ventas/")

    assert [venta["id"] for venta in respuesta.data] == [propia.data["id"]]


def test_ventas_no_se_editan_ni_se_borran(cliente_autenticado_dueno, ctx):
    venta_id = _crear_venta_api(cliente_autenticado_dueno, ctx).data["id"]

    assert cliente_autenticado_dueno.patch(
        f"/api/caja/ventas/{venta_id}/", {"nombre_cliente": "Otro"}, format="json"
    ).status_code == 405
    assert cliente_autenticado_dueno.delete(f"/api/caja/ventas/{venta_id}/").status_code == 405


def test_cajero_puede_cobrar_pero_no_anular(ctx):
    """`puede_anular_venta` es aparte de `puede_cobrar` a propósito:
    deshacer un cobro es la acción que sirve para tapar un faltante."""
    ctx["client_cajero"].post("/api/caja/abrir/", {}, format="json")
    venta_id = _crear_venta_api(ctx["client_cajero"], ctx).data["id"]

    cobro = ctx["client_cajero"].post(
        f"/api/caja/ventas/{venta_id}/cobrar/",
        {"monto": "20000", "metodo_pago": "efectivo"},
        format="json",
    )
    assert cobro.status_code == 200

    anulacion = ctx["client_cajero"].post(
        f"/api/caja/ventas/{venta_id}/anular/", {"motivo": "Me equivoqué"}, format="json"
    )
    assert anulacion.status_code == 403


def test_anular_venta_cobrada_genera_movimiento_inverso(cliente_autenticado_dueno, ctx):
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")
    venta_id = _crear_venta_api(cliente_autenticado_dueno, ctx).data["id"]
    cliente_autenticado_dueno.post(
        f"/api/caja/ventas/{venta_id}/cobrar/",
        {"monto": "20000", "metodo_pago": "efectivo"},
        format="json",
    )

    respuesta = cliente_autenticado_dueno.post(
        f"/api/caja/ventas/{venta_id}/anular/",
        {"motivo": "Cliente reclamó"},
        format="json",
    )

    assert respuesta.status_code == 200
    assert respuesta.data["estado"] == "anulada"
    assert MovimientoCaja.objects.filter(tipo=MovimientoCaja.Tipo.DEVOLUCION).count() == 1
    assert MovimientoCaja.objects.filter(tipo=MovimientoCaja.Tipo.INGRESO).count() == 1


def test_venta_de_otro_negocio_responde_404(ctx, empleado_con, negocio_con_dueno):
    from apps.negocios import services as negocios_services

    otro_negocio, _dueno, otra_membresia = negocios_services.registrar_negocio(
        nombre_negocio="Otra Barbería",
        email_dueno="otro@api.test",
        password_dueno="claveSegura123",
        nombre_dueno="Otro",
    )
    venta_ajena = services.crear_venta(
        negocio=otro_negocio,
        creada_por=otra_membresia,
        nombre_cliente="Ajeno",
        items=[
            {
                "descripcion": "Corte",
                "precio_unitario": Decimal("10000"),
                "empleado": otra_membresia,
            }
        ],
    )

    respuesta = ctx["client_cajero"].get(f"/api/caja/ventas/{venta_ajena.id}/")

    assert respuesta.status_code == 404


# --- integración con la agenda ---


def test_completar_cita_genera_la_venta_y_es_idempotente(
    cliente_autenticado_dueno, ctx, negocio_con_dueno
):
    """El flujo completo: el barbero termina, la cuenta le aparece a
    recepción, y dos toques al botón no generan dos cuentas."""
    from apps.agenda import services as agenda_services
    from django.utils import timezone
    import datetime

    inicio = timezone.now() + datetime.timedelta(days=1)
    inicio = inicio.replace(hour=10, minute=0, second=0, microsecond=0)
    agenda_services.reemplazar_horario_negocio(
        negocio=ctx["negocio"],
        franjas=[
            {
                "dia_semana": inicio.weekday(),
                "hora_inicio": datetime.time(8, 0),
                "hora_fin": datetime.time(20, 0),
            }
        ],
    )
    cita = agenda_services.agendar_cita(
        negocio=ctx["negocio"],
        servicio=ctx["servicio"],
        empleado=ctx["barbero"],
        fecha_hora_inicio=inicio,
        nombre_cliente="Juan Pérez",
    )

    primera = ctx["client_barbero"].post(f"/api/agenda/citas/{cita.id}/completar/")
    assert primera.status_code == 200
    assert primera.data["cita"]["estado"] == "completada"
    assert primera.data["venta"]["estado"] == "pendiente"
    assert primera.data["venta"]["total"] == "20000.00"

    segunda = ctx["client_barbero"].post(f"/api/agenda/citas/{cita.id}/completar/")

    assert segunda.status_code == 200
    assert segunda.data["venta"]["id"] == primera.data["venta"]["id"]
    assert Venta.objects.filter(cita=cita).count() == 1


def test_barbero_no_puede_cobrar_lo_que_completo(ctx, cliente_autenticado_dueno):
    """Su responsabilidad termina cuando termina el servicio."""
    cliente_autenticado_dueno.post("/api/caja/abrir/", {}, format="json")
    venta = services.crear_venta(
        negocio=ctx["negocio"],
        creada_por=ctx["barbero"],
        nombre_cliente="Juan",
        items=[{"servicio": ctx["servicio"], "empleado": ctx["barbero"]}],
    )

    respuesta = ctx["client_barbero"].post(
        f"/api/caja/ventas/{venta.id}/cobrar/",
        {"monto": "20000", "metodo_pago": MetodoPago.EFECTIVO},
        format="json",
    )

    assert respuesta.status_code == 403
