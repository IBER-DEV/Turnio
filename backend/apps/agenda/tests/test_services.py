import datetime

import pytest
from django.utils import timezone

from apps.agenda import services
from apps.agenda.models import Cita, DiaSemana

pytestmark = pytest.mark.django_db

LUNES_10AM = timezone.make_aware(datetime.datetime(2024, 1, 1, 10, 0))  # 2024-01-01 es lunes


def test_crear_horario_invalido_lanza_error(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    with pytest.raises(services.HorarioInvalido):
        services.crear_horario(
            miembro=membresia,
            dia_semana=DiaSemana.LUNES,
            hora_inicio=datetime.time(12, 0),
            hora_fin=datetime.time(9, 0),
        )


def test_empleado_disponible_dentro_de_su_horario_sin_citas(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )

    disponible = services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )

    assert disponible is True


def test_empleado_no_disponible_fuera_de_su_horario(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(14, 0),
        hora_fin=datetime.time(18, 0),
    )

    disponible = services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )

    assert disponible is False


def test_empleado_no_disponible_si_hay_cita_que_se_cruza(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )
    services.agendar_cita(
        negocio=negocio,
        servicio=servicio_de_prueba,
        empleado=membresia,
        fecha_hora_inicio=LUNES_10AM,
        nombre_cliente="Cliente Uno",
    )

    disponible = services.empleado_disponible(
        empleado=membresia,
        inicio=LUNES_10AM + datetime.timedelta(minutes=15),
        fin=LUNES_10AM + datetime.timedelta(minutes=45),
    )

    assert disponible is False


def test_agendar_cita_sin_empleado_asigna_el_primero_disponible(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )

    cita = services.agendar_cita(
        negocio=negocio,
        servicio=servicio_de_prueba,
        empleado=None,
        fecha_hora_inicio=LUNES_10AM,
        nombre_cliente="Cliente Cualquiera",
    )

    assert cita.empleado_id == membresia.id
    assert cita.fecha_hora_fin == LUNES_10AM + datetime.timedelta(minutes=30)
    assert cita.estado == Cita.Estado.AGENDADA


def test_agendar_cita_sin_disponibilidad_lanza_error(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, _membresia = negocio_con_dueno
    # Nadie tiene horario cargado todavía.
    with pytest.raises(services.SinDisponibilidad):
        services.agendar_cita(
            negocio=negocio,
            servicio=servicio_de_prueba,
            empleado=None,
            fecha_hora_inicio=LUNES_10AM,
            nombre_cliente="Cliente Sin Cupo",
        )


def test_cambiar_estado_sigue_transiciones_validas(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )
    cita = services.agendar_cita(
        negocio=negocio,
        servicio=servicio_de_prueba,
        empleado=membresia,
        fecha_hora_inicio=LUNES_10AM,
        nombre_cliente="Cliente Uno",
    )

    cita = services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.CONFIRMADA)
    cita = services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.COMPLETADA)

    assert cita.estado == Cita.Estado.COMPLETADA


def test_cambiar_estado_rechaza_transicion_invalida(negocio_con_dueno, servicio_de_prueba):
    negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )
    cita = services.agendar_cita(
        negocio=negocio,
        servicio=servicio_de_prueba,
        empleado=membresia,
        fecha_hora_inicio=LUNES_10AM,
        nombre_cliente="Cliente Uno",
    )
    cita = services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.CONFIRMADA)
    cita = services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.COMPLETADA)

    with pytest.raises(services.TransicionEstadoInvalida):
        services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.CANCELADA)
