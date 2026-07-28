"""Separación de capacidades de agenda y visibilidad de citas.

Desde 2026-07-26 las capacidades viven en `Cargo`, así que "un empleado
que solo puede X" se arma con la fixture `empleado_con`.
"""

import datetime

import pytest
from django.utils import timezone

from apps.agenda import services
from apps.negocios import services as negocios_services
from apps.usuarios.models import Cargo

pytestmark = pytest.mark.django_db

LUNES_10AM = timezone.make_aware(datetime.datetime(2024, 1, 1, 10, 0))
FRANJA_LUNES = [{"dia_semana": 0, "hora_inicio": "09:00:00", "hora_fin": "18:00:00"}]


# --- El caso que motivó la separación: agendar sin decidir el horario ---


@pytest.fixture
def recepcionista(negocio_con_dueno, empleado_con):
    """Opera la agenda del día, pero no decide cuándo abre el local."""
    negocio, _dueno, _membresia = negocio_con_dueno
    return empleado_con(
        negocio=negocio,
        email="recepcion@test.com",
        nombre="Recepcion",
        tipo=Cargo.Tipo.RECEPCION,
        capacidades=["puede_gestionar_agenda", "puede_ver_agenda_completa"],
    )


def test_recepcionista_puede_agendar_citas(
    recepcionista, servicio_de_prueba, cliente_autenticado_dueno
):
    cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/", {"franjas": FRANJA_LUNES}, format="json"
    )
    _membresia, client = recepcionista

    respuesta = client.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente",
        },
        format="json",
    )

    assert respuesta.status_code == 201, respuesta.data


def test_recepcionista_no_puede_cambiar_el_horario_del_negocio(recepcionista, negocio_con_dueno):
    """El caso exacto que pidió el humano: gestiona citas, no horarios."""
    negocio, _dueno, _membresia = negocio_con_dueno
    _membresia_recepcion, client = recepcionista

    respuesta = client.put(
        "/api/agenda/horario-negocio/",
        {"franjas": [{"dia_semana": 3, "hora_inicio": "07:00:00", "hora_fin": "23:00:00"}]},
        format="json",
    )

    assert respuesta.status_code == 403
    assert negocio.horarios.count() == 0


def test_recepcionista_no_puede_cambiar_el_horario_de_un_empleado(
    recepcionista, negocio_con_dueno
):
    _negocio, _dueno, membresia_dueno = negocio_con_dueno
    _membresia_recepcion, client = recepcionista

    respuesta = client.put(
        "/api/agenda/horarios/semana/",
        {"miembros": [membresia_dueno.id], "franjas": FRANJA_LUNES},
        format="json",
    )

    assert respuesta.status_code == 403
    assert membresia_dueno.horarios.count() == 0


def test_quien_configura_horarios_no_puede_agendar_citas(
    negocio_con_dueno, empleado_con, servicio_de_prueba, cliente_autenticado_dueno
):
    """La separación corta en las dos direcciones, no solo en una."""
    negocio, _dueno, _membresia = negocio_con_dueno
    cliente_autenticado_dueno.put(
        "/api/agenda/horario-negocio/", {"franjas": FRANJA_LUNES}, format="json"
    )
    _membresia, client = empleado_con(
        negocio=negocio,
        email="rrhh@test.com",
        nombre="RRHH",
        capacidades=["puede_configurar_horarios"],
    )

    respuesta = client.post(
        "/api/agenda/citas/",
        {
            "servicio": servicio_de_prueba.id,
            "fecha_hora_inicio": LUNES_10AM.isoformat(),
            "nombre_cliente": "Cliente",
        },
        format="json",
    )

    assert respuesta.status_code == 403


def test_quien_configura_horarios_si_puede_cambiarlos(negocio_con_dueno, empleado_con):
    negocio, _dueno, _membresia = negocio_con_dueno
    _membresia, client = empleado_con(
        negocio=negocio,
        email="rrhh@test.com",
        nombre="RRHH",
        capacidades=["puede_configurar_horarios"],
    )

    respuesta = client.put(
        "/api/agenda/horario-negocio/", {"franjas": FRANJA_LUNES}, format="json"
    )

    assert respuesta.status_code == 200, respuesta.data
    assert negocio.horarios.count() == 1


# --- Visibilidad: la agenda completa es la libreta de clientes ---


@pytest.fixture
def negocio_con_dos_barberos(negocio_con_dueno, servicio_de_prueba, empleado_con):
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio,
        franjas=[
            {
                "dia_semana": 0,
                "hora_inicio": datetime.time(9, 0),
                "hora_fin": datetime.time(18, 0),
            }
        ],
    )
    barbero, client_barbero = empleado_con(
        negocio=negocio, email="barbero@test.com", nombre="Barbero"
    )

    def _cita(empleado, nombre_cliente, hora):
        return services.agendar_cita(
            negocio=negocio,
            servicio=servicio_de_prueba,
            empleado=empleado,
            fecha_hora_inicio=hora,
            nombre_cliente=nombre_cliente,
            telefono_cliente="3001234567",
        )

    _cita(barbero, "Cliente Del Barbero", LUNES_10AM)
    _cita(membresia_dueno, "Cliente Del Dueno", LUNES_10AM + datetime.timedelta(hours=2))
    return client_barbero, barbero, negocio


def test_empleado_sin_la_capacidad_solo_ve_sus_propias_citas(negocio_con_dos_barberos):
    client_barbero, _barbero, _negocio = negocio_con_dos_barberos

    respuesta = client_barbero.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    nombres = {cita["nombre_cliente"] for cita in respuesta.data}
    assert nombres == {"Cliente Del Barbero"}


def test_no_puede_leer_la_cita_ajena_ni_pidiendola_por_id(negocio_con_dos_barberos):
    """Filtrar la lista no sirve de nada si el detalle sigue abierto."""
    client_barbero, _barbero, negocio = negocio_con_dos_barberos
    ajena = negocio.citas.get(nombre_cliente="Cliente Del Dueno")

    respuesta = client_barbero.get(f"/api/agenda/citas/{ajena.id}/")

    assert respuesta.status_code == 404


def test_no_puede_transicionar_una_cita_ajena(negocio_con_dos_barberos):
    client_barbero, _barbero, negocio = negocio_con_dos_barberos
    ajena = negocio.citas.get(nombre_cliente="Cliente Del Dueno")

    respuesta = client_barbero.post(f"/api/agenda/citas/{ajena.id}/confirmar/")

    assert respuesta.status_code == 404
    ajena.refresh_from_db()
    assert ajena.estado == "agendada"


def test_sigue_pudiendo_transicionar_las_propias(negocio_con_dos_barberos):
    """La propiedad sigue habilitando: el filtro no le quita al empleado
    el control de su propio trabajo."""
    client_barbero, _barbero, negocio = negocio_con_dos_barberos
    propia = negocio.citas.get(nombre_cliente="Cliente Del Barbero")

    respuesta = client_barbero.post(f"/api/agenda/citas/{propia.id}/confirmar/")

    assert respuesta.status_code == 200
    propia.refresh_from_db()
    assert propia.estado == "confirmada"


def test_con_la_capacidad_ve_toda_la_agenda(negocio_con_dos_barberos):
    client_barbero, barbero, _negocio = negocio_con_dos_barberos
    barbero.cargo.puede_ver_agenda_completa = True
    barbero.cargo.save(update_fields=["puede_ver_agenda_completa"])

    respuesta = client_barbero.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    nombres = {cita["nombre_cliente"] for cita in respuesta.data}
    assert nombres == {"Cliente Del Barbero", "Cliente Del Dueno"}


def test_el_dueno_ve_toda_la_agenda(negocio_con_dos_barberos, cliente_autenticado_dueno):
    respuesta = cliente_autenticado_dueno.get("/api/agenda/citas/")

    assert respuesta.status_code == 200
    assert len(respuesta.data) == 2


def test_el_telefono_del_cliente_ajeno_no_se_filtra(negocio_con_dos_barberos):
    """Lo que realmente se está protegiendo: la libreta de clientes."""
    client_barbero, _barbero, _negocio = negocio_con_dos_barberos

    respuesta = client_barbero.get("/api/agenda/citas/")

    assert len([cita["telefono_cliente"] for cita in respuesta.data]) == 1


# --- El negocio nace configurado ---


def test_el_negocio_nace_con_sus_cargos_y_el_dueno_en_administracion(negocio_con_dueno):
    negocio, _dueno, membresia = negocio_con_dueno

    assert negocio.cargos.count() == len(negocios_services.CARGOS_INICIALES)
    assert membresia.cargo.tipo == Cargo.Tipo.ADMINISTRACION
    assert all(membresia.tiene(campo) for campo in negocios_services.CAMPOS_CAPACIDADES)


def test_mi_membresia_expone_el_tipo_y_el_cargo(cliente_autenticado_dueno):
    """El frontend monta el shell con `tipo` y gatea acciones con el
    cargo; si falta cualquiera de los dos, no puede."""
    respuesta = cliente_autenticado_dueno.get("/api/negocios/mi-membresia/")

    assert respuesta.status_code == 200
    assert respuesta.data["tipo"] == Cargo.Tipo.ADMINISTRACION
    assert respuesta.data["cargo"]["nombre"] == "Administración"
    assert respuesta.data["cargo"]["puede_configurar_horarios"] is True


def test_el_cargo_expone_todas_las_capacidades_del_modelo(cliente_autenticado_dueno):
    """Atrapa la deriva: agregar una capacidad al modelo y olvidarla en el
    serializer la dejaría invisible para el frontend."""
    respuesta = cliente_autenticado_dueno.get("/api/negocios/mi-membresia/")

    assert set(negocios_services.CAMPOS_CAPACIDADES) <= set(respuesta.data["cargo"])


def test_un_empleado_sin_cargo_explicito_entra_al_operativo(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno

    _usuario, membresia = negocios_services.agregar_empleado(
        negocio=negocio, email="nuevo@test.com", password="claveSegura123", nombre="Nuevo"
    )

    assert membresia.cargo.tipo == Cargo.Tipo.OPERATIVO
    assert not any(membresia.tiene(campo) for campo in negocios_services.CAMPOS_CAPACIDADES)
