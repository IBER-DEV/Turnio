import datetime

import pytest
from django.utils import timezone

from apps.agenda import services
from apps.agenda.models import Cita, DiaSemana
from apps.negocios import services as negocios_services

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


def test_empleado_soporta_dos_bloques_el_mismo_dia_para_modelar_el_almuerzo(negocio_con_dueno):
    """HorarioTrabajo no tiene constraint único por (miembro, dia_semana):
    un descanso de almuerzo se modela como dos bloques el mismo día."""
    _negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(8, 0),
        hora_fin=datetime.time(12, 0),
    )
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.LUNES,
        hora_inicio=datetime.time(13, 0),
        hora_fin=datetime.time(18, 0),
    )

    # Dentro del bloque de la mañana: disponible.
    assert services.empleado_disponible(
        empleado=membresia,
        inicio=LUNES_10AM,
        fin=LUNES_10AM + datetime.timedelta(minutes=30),
    ) is True

    # Dentro del bloque de la tarde: disponible.
    tarde = LUNES_10AM.replace(hour=15)
    assert services.empleado_disponible(
        empleado=membresia, inicio=tarde, fin=tarde + datetime.timedelta(minutes=30)
    ) is True

    # Cruza el descanso de almuerzo (11:30-12:30): no cabe en ningún bloque completo.
    cruce_almuerzo = LUNES_10AM.replace(hour=11, minute=30)
    assert services.empleado_disponible(
        empleado=membresia,
        inicio=cruce_almuerzo,
        fin=cruce_almuerzo + datetime.timedelta(hours=1),
    ) is False


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
    cita = services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.EN_ATENCION)
    cita, _venta = services.completar_cita(cita=cita, responsable=membresia)

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
    cita, _venta = services.completar_cita(cita=cita, responsable=membresia)

    with pytest.raises(services.TransicionEstadoInvalida):
        services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.CANCELADA)


def test_completar_no_pasa_por_cambiar_estado_cita(negocio_con_dueno, servicio_de_prueba):
    """Completar genera la venta, así que tiene que pasar sí o sí por
    `completar_cita`. Si `cambiar_estado_cita` lo dejara hacer, quedarían
    citas completadas sin cuenta que cobrar."""
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

    with pytest.raises(services.TransicionEstadoInvalida):
        services.cambiar_estado_cita(cita=cita, nuevo_estado=Cita.Estado.COMPLETADA)


# --- Horario semanal en lote (reemplazo atómico) ---


def _franja(dia, desde, hasta):
    return {
        "dia_semana": dia,
        "hora_inicio": datetime.time(desde, 0),
        "hora_fin": datetime.time(hasta, 0),
    }


def test_reemplazar_horario_semanal_crea_la_semana_completa(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    services.reemplazar_horario_semanal(
        miembros=[membresia],
        franjas=[_franja(dia, 9, 18) for dia in range(5)],
    )

    assert membresia.horarios.count() == 5


def test_reemplazar_horario_semanal_borra_lo_anterior(negocio_con_dueno):
    """Es reemplazo, no acumulación: lo que no viene en la lista se va."""
    _negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.DOMINGO,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(12, 0),
    )

    services.reemplazar_horario_semanal(
        miembros=[membresia], franjas=[_franja(DiaSemana.LUNES, 9, 18)]
    )

    dias = list(membresia.horarios.values_list("dia_semana", flat=True))
    assert dias == [DiaSemana.LUNES]


def test_reemplazar_horario_semanal_admite_dos_franjas_el_mismo_dia(negocio_con_dueno):
    """El caso del almuerzo: mañana y tarde partidas."""
    _negocio, _dueno, membresia = negocio_con_dueno

    services.reemplazar_horario_semanal(
        miembros=[membresia],
        franjas=[_franja(DiaSemana.LUNES, 8, 12), _franja(DiaSemana.LUNES, 14, 18)],
    )

    assert membresia.horarios.filter(dia_semana=DiaSemana.LUNES).count() == 2


def test_reemplazar_horario_semanal_rechaza_franjas_cruzadas(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    with pytest.raises(services.FranjasSolapadas):
        services.reemplazar_horario_semanal(
            miembros=[membresia],
            franjas=[_franja(DiaSemana.LUNES, 9, 14), _franja(DiaSemana.LUNES, 13, 18)],
        )


def test_reemplazar_horario_semanal_rechaza_hora_invertida(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    with pytest.raises(services.HorarioInvalido):
        services.reemplazar_horario_semanal(
            miembros=[membresia], franjas=[_franja(DiaSemana.LUNES, 18, 9)]
        )


def test_reemplazar_horario_semanal_no_deja_estado_parcial_si_falla(negocio_con_dueno):
    """Lo que motivó el endpoint: o entra la semana entera, o nada."""
    _negocio, _dueno, membresia = negocio_con_dueno
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.VIERNES,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(18, 0),
    )

    with pytest.raises(services.FranjasSolapadas):
        services.reemplazar_horario_semanal(
            miembros=[membresia],
            franjas=[
                _franja(DiaSemana.LUNES, 9, 18),
                _franja(DiaSemana.MARTES, 9, 14),
                _franja(DiaSemana.MARTES, 13, 18),  # se cruza con la anterior
            ],
        )

    # El horario viejo sigue intacto: no se borró nada.
    dias = list(membresia.horarios.values_list("dia_semana", flat=True))
    assert dias == [DiaSemana.VIERNES]


def test_reemplazar_horario_semanal_con_lista_vacia_devuelve_a_heredar(negocio_con_dueno):
    """`franjas: []` quita la excepción, no la disponibilidad.

    Antes de que existiera el horario del negocio, vaciar el horario propio
    dejaba al empleado sin poder recibir citas. Ahora significa "este ya no
    es un caso especial": vuelve al horario del local.
    """
    negocio, _dueno, membresia = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(DiaSemana.LUNES, 9, 18)]
    )
    services.crear_horario(
        miembro=membresia,
        dia_semana=DiaSemana.SABADO,
        hora_inicio=datetime.time(9, 0),
        hora_fin=datetime.time(14, 0),
    )
    assert not services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )

    services.reemplazar_horario_semanal(miembros=[membresia], franjas=[])

    assert membresia.horarios.count() == 0
    assert services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )


def test_reemplazar_horario_semanal_aplica_a_varios_empleados_de_una(negocio_con_dueno):
    negocio, _dueno, membresia = negocio_con_dueno
    _usuario_a, medio_tiempo_a = negocios_services.agregar_empleado(
        negocio=negocio, email="a@test.com", password="claveSegura123", nombre="A"
    )
    _usuario_b, medio_tiempo_b = negocios_services.agregar_empleado(
        negocio=negocio, email="b@test.com", password="claveSegura123", nombre="B"
    )

    services.reemplazar_horario_semanal(
        miembros=[medio_tiempo_a, medio_tiempo_b],
        franjas=[_franja(DiaSemana.SABADO, 9, 14)],
    )

    assert medio_tiempo_a.horarios.count() == 1
    assert medio_tiempo_b.horarios.count() == 1
    # A quien no se nombró no se le tocó nada.
    assert membresia.horarios.count() == 0


def test_reemplazar_horario_semanal_no_duplica_si_se_repite_el_empleado(negocio_con_dueno):
    _negocio, _dueno, membresia = negocio_con_dueno

    services.reemplazar_horario_semanal(
        miembros=[membresia, membresia], franjas=[_franja(DiaSemana.LUNES, 9, 18)]
    )

    assert membresia.horarios.count() == 1


def test_reemplazar_horario_semanal_de_varios_no_deja_estado_parcial(negocio_con_dueno):
    """Con varios empleados la atomicidad importa más: o cambia el equipo
    entero, o no cambia nadie."""
    negocio, _dueno, membresia = negocio_con_dueno
    _usuario, otro = negocios_services.agregar_empleado(
        negocio=negocio, email="otro@test.com", password="claveSegura123", nombre="Otro"
    )
    for miembro in (membresia, otro):
        services.crear_horario(
            miembro=miembro,
            dia_semana=DiaSemana.VIERNES,
            hora_inicio=datetime.time(9, 0),
            hora_fin=datetime.time(18, 0),
        )

    with pytest.raises(services.FranjasSolapadas):
        services.reemplazar_horario_semanal(
            miembros=[membresia, otro],
            franjas=[_franja(DiaSemana.LUNES, 9, 14), _franja(DiaSemana.LUNES, 13, 18)],
        )

    for miembro in (membresia, otro):
        assert list(miembro.horarios.values_list("dia_semana", flat=True)) == [DiaSemana.VIERNES]


# --- Horario del negocio y herencia ---


def test_empleado_sin_horario_propio_hereda_el_del_negocio(negocio_con_dueno):
    """El caso que motivó todo esto: cargar el horario una vez, en el
    negocio, y que el equipo entero quede disponible."""
    negocio, _dueno, membresia = negocio_con_dueno

    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(dia, 9, 18) for dia in range(5)]
    )

    assert membresia.horarios.count() == 0
    assert services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )


def test_empleado_nuevo_queda_disponible_sin_configurarle_nada(negocio_con_dueno):
    """Antes, un empleado recién dado de alta no podía recibir citas hasta
    que alguien se acordara de cargarle el horario a mano."""
    negocio, _dueno, _membresia = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(DiaSemana.LUNES, 9, 18)]
    )

    _usuario, recien_llegado = negocios_services.agregar_empleado(
        negocio=negocio, email="nuevo@test.com", password="claveSegura123", nombre="Nuevo"
    )

    assert services.empleado_disponible(
        empleado=recien_llegado, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )


def test_horario_propio_reemplaza_al_del_negocio_no_lo_amplia(negocio_con_dueno):
    """El de medio tiempo: el local abre lunes, él solo viene sábados."""
    negocio, _dueno, membresia = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(DiaSemana.LUNES, 9, 18)]
    )

    services.reemplazar_horario_semanal(
        miembros=[membresia], franjas=[_franja(DiaSemana.SABADO, 9, 14)]
    )

    assert not services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )


def test_horario_propio_de_un_dia_no_hace_heredar_los_demas(negocio_con_dueno):
    """Se pregunta por horario propio en toda la semana, no día por día.

    Si se preguntara por día, el empleado del test anterior heredaría el
    lunes del negocio y su 'solo sábados' no significaría nada.
    """
    negocio, _dueno, membresia = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(dia, 9, 18) for dia in range(6)]
    )
    services.reemplazar_horario_semanal(
        miembros=[membresia], franjas=[_franja(DiaSemana.SABADO, 9, 14)]
    )

    franjas_lunes = services._franjas_vigentes(empleado=membresia, dia_semana=DiaSemana.LUNES)

    assert list(franjas_lunes) == []


def test_empleado_inactivo_no_esta_disponible_aunque_el_negocio_abra(negocio_con_dueno):
    """Con herencia, un inactivo tomaría el horario del local si no se
    chequea `activo` explícitamente."""
    negocio, _dueno, membresia = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(DiaSemana.LUNES, 9, 18)]
    )
    membresia.activo = False
    membresia.save(update_fields=["activo"])

    assert not services.empleado_disponible(
        empleado=membresia, inicio=LUNES_10AM, fin=LUNES_10AM + datetime.timedelta(minutes=30)
    )


def test_reemplazar_horario_negocio_reemplaza_y_valida_igual_que_el_propio(negocio_con_dueno):
    negocio, _dueno, _membresia = negocio_con_dueno
    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(DiaSemana.DOMINGO, 9, 12)]
    )

    services.reemplazar_horario_negocio(
        negocio=negocio, franjas=[_franja(DiaSemana.LUNES, 8, 12), _franja(DiaSemana.LUNES, 14, 18)]
    )

    assert list(negocio.horarios.values_list("dia_semana", flat=True)) == [
        DiaSemana.LUNES,
        DiaSemana.LUNES,
    ]

    with pytest.raises(services.FranjasSolapadas):
        services.reemplazar_horario_negocio(
            negocio=negocio,
            franjas=[_franja(DiaSemana.MARTES, 9, 14), _franja(DiaSemana.MARTES, 13, 18)],
        )
    # El horario válido anterior sigue intacto.
    assert negocio.horarios.count() == 2
