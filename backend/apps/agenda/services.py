from datetime import timedelta

from django.db import transaction

from apps.agenda.models import Cita, HorarioTrabajo


class HorarioInvalido(Exception):
    """hora_inicio no es anterior a hora_fin."""


class SinDisponibilidad(Exception):
    """Ningún empleado (o el empleado pedido) tiene cupo en ese horario."""


class TransicionEstadoInvalida(Exception):
    """La cita no puede pasar de su estado actual al estado pedido."""


TRANSICIONES_VALIDAS = {
    Cita.Estado.AGENDADA: {Cita.Estado.CONFIRMADA, Cita.Estado.CANCELADA},
    Cita.Estado.CONFIRMADA: {Cita.Estado.COMPLETADA, Cita.Estado.CANCELADA},
    Cita.Estado.COMPLETADA: set(),
    Cita.Estado.CANCELADA: set(),
}


def crear_horario(*, miembro, dia_semana, hora_inicio, hora_fin):
    if hora_inicio >= hora_fin:
        raise HorarioInvalido("hora_inicio debe ser anterior a hora_fin")
    return HorarioTrabajo.objects.create(
        tenant=miembro.tenant,
        miembro=miembro,
        dia_semana=dia_semana,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
    )


class FranjasSolapadas(Exception):
    """Dos franjas del mismo día se cruzan entre sí."""


@transaction.atomic
def reemplazar_horario_semanal(*, miembro, franjas):
    """Deja el horario semanal de `miembro` exactamente como dice `franjas`.

    Reemplaza, no acumula: lo que no venga en la lista se borra. Existe
    porque el frontend editaba la semana con N llamadas (un DELETE o un
    POST por franja), lo que no es atómico — si fallaba a la mitad, el
    empleado quedaba con media semana cargada y sin forma de saberlo.

    `franjas` es una lista de dicts con `dia_semana`, `hora_inicio` y
    `hora_fin`. Borrar horarios no afecta a las citas ya agendadas: la
    `Cita` guarda su propia fecha/hora y no se recalcula desde acá.
    """
    for franja in franjas:
        if franja["hora_inicio"] >= franja["hora_fin"]:
            raise HorarioInvalido(
                f"hora_inicio debe ser anterior a hora_fin "
                f"(día {franja['dia_semana']}: {franja['hora_inicio']}–{franja['hora_fin']})"
            )

    por_dia = {}
    for franja in franjas:
        por_dia.setdefault(franja["dia_semana"], []).append(franja)

    for dia, del_dia in por_dia.items():
        ordenadas = sorted(del_dia, key=lambda franja: franja["hora_inicio"])
        for anterior, siguiente in zip(ordenadas, ordenadas[1:]):
            if siguiente["hora_inicio"] < anterior["hora_fin"]:
                raise FranjasSolapadas(
                    f"Hay dos franjas que se cruzan el día {dia}: "
                    f"{anterior['hora_inicio']}–{anterior['hora_fin']} y "
                    f"{siguiente['hora_inicio']}–{siguiente['hora_fin']}"
                )

    miembro.horarios.all().delete()
    return HorarioTrabajo.objects.bulk_create(
        [
            HorarioTrabajo(
                tenant=miembro.tenant,
                miembro=miembro,
                dia_semana=franja["dia_semana"],
                hora_inicio=franja["hora_inicio"],
                hora_fin=franja["hora_fin"],
            )
            for franja in franjas
        ]
    )


def empleado_disponible(*, empleado, inicio, fin):
    dia_semana = inicio.weekday()
    tiene_horario = HorarioTrabajo.objects.filter(
        miembro=empleado,
        dia_semana=dia_semana,
        hora_inicio__lte=inicio.time(),
        hora_fin__gte=fin.time(),
    ).exists()
    if not tiene_horario:
        return False

    hay_cruce = (
        Cita.objects.filter(empleado=empleado)
        .exclude(estado=Cita.Estado.CANCELADA)
        .filter(fecha_hora_inicio__lt=fin, fecha_hora_fin__gt=inicio)
        .exists()
    )
    return not hay_cruce


@transaction.atomic
def agendar_cita(
    *,
    negocio,
    servicio,
    fecha_hora_inicio,
    nombre_cliente,
    telefono_cliente="",
    notas="",
    empleado=None,
):
    """Agenda una cita. Si `empleado` es None, asigna el primer empleado
    activo del negocio con disponibilidad real ("cualquiera disponible").
    """
    fecha_hora_fin = fecha_hora_inicio + timedelta(minutes=servicio.duracion_minutos)

    candidatos = [empleado] if empleado is not None else list(
        negocio.miembros.filter(activo=True)
    )

    empleado_asignado = next(
        (
            candidato
            for candidato in candidatos
            if empleado_disponible(empleado=candidato, inicio=fecha_hora_inicio, fin=fecha_hora_fin)
        ),
        None,
    )
    if empleado_asignado is None:
        raise SinDisponibilidad("No hay ningún empleado disponible en ese horario.")

    return Cita.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        empleado=empleado_asignado,
        servicio=servicio,
        fecha_hora_inicio=fecha_hora_inicio,
        fecha_hora_fin=fecha_hora_fin,
        nombre_cliente=nombre_cliente,
        telefono_cliente=telefono_cliente,
        notas=notas,
    )


def cambiar_estado_cita(*, cita, nuevo_estado):
    transiciones_permitidas = TRANSICIONES_VALIDAS[cita.estado]
    if nuevo_estado not in transiciones_permitidas:
        raise TransicionEstadoInvalida(
            f"No se puede pasar de '{cita.estado}' a '{nuevo_estado}'."
        )
    cita.estado = nuevo_estado
    cita.save(update_fields=["estado", "actualizado_en"])
    return cita
