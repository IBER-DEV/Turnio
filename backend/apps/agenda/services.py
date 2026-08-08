from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from apps.agenda.models import Cita, HorarioNegocio, HorarioTrabajo


class HorarioInvalido(Exception):
    """hora_inicio no es anterior a hora_fin."""


class SinDisponibilidad(Exception):
    """Ningún empleado (o el empleado pedido) tiene cupo en ese horario."""


class TransicionEstadoInvalida(Exception):
    """La cita no puede pasar de su estado actual al estado pedido."""


class CitaNoCompletable(Exception):
    """La cita no está en un estado desde el que se pueda completar."""


#: `en_atencion` es opcional: se puede pasar de `confirmada` a
#: `completada` directo, porque en un local de dos sillas nadie va a
#: marcar que el cliente se sentó. `completada`, `cancelada` y `no_show`
#: son terminales — lo que pase después con la plata es asunto de la
#: `Venta`, no de la cita.
TRANSICIONES_VALIDAS = {
    Cita.Estado.AGENDADA: {
        Cita.Estado.CONFIRMADA,
        Cita.Estado.EN_ATENCION,
        Cita.Estado.CANCELADA,
        Cita.Estado.NO_SHOW,
    },
    Cita.Estado.CONFIRMADA: {
        Cita.Estado.EN_ATENCION,
        Cita.Estado.COMPLETADA,
        Cita.Estado.CANCELADA,
        Cita.Estado.NO_SHOW,
    },
    Cita.Estado.EN_ATENCION: {Cita.Estado.COMPLETADA, Cita.Estado.CANCELADA},
    Cita.Estado.COMPLETADA: set(),
    Cita.Estado.CANCELADA: set(),
    Cita.Estado.NO_SHOW: set(),
}

#: Estados que **no** ocupan el calendario: su franja vuelve a ofrecerse.
ESTADOS_LIBERAN_CUPO = {Cita.Estado.CANCELADA, Cita.Estado.NO_SHOW}


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


def _validar_franjas(franjas):
    """Valida la semana en sí: horas coherentes y sin cruces dentro del día.

    Es independiente de a quién se le aplique — por eso se valida una sola
    vez aunque el horario vaya para varios empleados.
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


@transaction.atomic
def reemplazar_horario_negocio(*, negocio, franjas):
    """Deja el horario de atención del negocio exactamente como dice `franjas`.

    Este es el horario que rige por defecto para **todo** el equipo: quien
    no tenga horario propio cargado, trabaja este. Cambiarlo acá cambia la
    disponibilidad de todos los que heredan, en un solo lugar — que es
    justamente lo que no se podía hacer cuando el horario solo existía por
    empleado.

    Mismo reemplazo atómico que el horario por empleado: la lista enviada
    es el horario completo, y si algo es inválido no se toca nada.
    """
    _validar_franjas(franjas)

    negocio.horarios.all().delete()
    return HorarioNegocio.objects.bulk_create(
        [
            HorarioNegocio(
                tenant=negocio.tenant,
                negocio=negocio,
                dia_semana=franja["dia_semana"],
                hora_inicio=franja["hora_inicio"],
                hora_fin=franja["hora_fin"],
            )
            for franja in franjas
        ]
    )


@transaction.atomic
def reemplazar_horario_semanal(*, miembros, franjas):
    """Deja el horario **propio** de cada uno de `miembros` exactamente como
    dice `franjas`.

    El horario propio es la excepción al horario del negocio, para quien
    no trabaja como el resto (medio tiempo, solo sábados, turno de tarde).
    Mandar `franjas: []` le quita el horario propio y lo devuelve a heredar
    el del negocio — para dejar a alguien sin trabajar, la palanca es
    `activo=False` en su membresía, no un horario vacío.

    Recibe **varios** empleados por la misma razón que el resto del módulo
    trata al equipo como plural: los tres de medio tiempo suelen compartir
    turno. Un solo empleado es el caso n=1 de esta misma firma.

    Reemplaza, no acumula: lo que no venga en la lista se borra. Existe
    porque el frontend editaba la semana con N llamadas (un DELETE o un
    POST por franja), lo que no es atómico — si fallaba a la mitad, el
    empleado quedaba con media semana cargada y sin forma de saberlo. Con
    varios empleados esa garantía importa más, no menos: o queda el equipo
    completo, o no cambia nadie.

    `franjas` es una lista de dicts con `dia_semana`, `hora_inicio` y
    `hora_fin`. Borrar horarios no afecta a las citas ya agendadas: la
    `Cita` guarda su propia fecha/hora y no se recalcula desde acá.
    """
    _validar_franjas(franjas)

    # Repetir un empleado en la lista no debe duplicarle las franjas.
    unicos = list({miembro.pk: miembro for miembro in miembros}.values())

    HorarioTrabajo.objects.filter(miembro__in=unicos).delete()
    return HorarioTrabajo.objects.bulk_create(
        [
            HorarioTrabajo(
                tenant=miembro.tenant,
                miembro=miembro,
                dia_semana=franja["dia_semana"],
                hora_inicio=franja["hora_inicio"],
                hora_fin=franja["hora_fin"],
            )
            for miembro in unicos
            for franja in franjas
        ]
    )


def _franjas_vigentes(*, empleado, dia_semana):
    """Las franjas que realmente rigen para `empleado` ese día.

    El horario del negocio es el que manda: todo empleado lo hereda. Solo
    si el empleado tiene horario propio cargado, ese **reemplaza** al del
    negocio por completo.

    Dos decisiones que no son obvias:

    - Se pregunta si tiene horario propio **en toda la semana**, no ese
      día. Si no, un empleado con horario propio solo los sábados
      heredaría el del negocio de lunes a viernes — o sea, lo contrario
      de lo que quiso decir quien lo configuró así.
    - El horario propio **no se interseca** con el del negocio. Si el
      dueño le pone 8–20 a alguien y el local abre 9–18, vale 8–20: hay
      quien abre temprano con llave propia, y explicar "puse 8 pero el
      sistema agenda desde las 9" es peor que respetar lo que se
      configuró explícitamente.
    """
    if HorarioTrabajo.objects.filter(miembro=empleado).exists():
        return HorarioTrabajo.objects.filter(miembro=empleado, dia_semana=dia_semana)
    return HorarioNegocio.objects.filter(negocio=empleado.negocio, dia_semana=dia_semana)


def empleado_disponible(*, empleado, inicio, fin):
    # Un empleado inactivo no atiende, herede lo que herede. Importa desde
    # que el horario se hereda: antes un empleado inactivo simplemente no
    # tenía franjas propias y quedaba fuera solo, sin necesidad de este
    # chequeo.
    if not empleado.activo:
        return False

    dia_semana = inicio.weekday()
    tiene_horario = (
        _franjas_vigentes(empleado=empleado, dia_semana=dia_semana)
        .filter(hora_inicio__lte=inicio.time(), hora_fin__gte=fin.time())
        .exists()
    )
    if not tiene_horario:
        return False

    hay_cruce = (
        Cita.objects.filter(empleado=empleado)
        .exclude(estado__in=ESTADOS_LIBERAN_CUPO)
        .filter(fecha_hora_inicio__lt=fin, fecha_hora_fin__gt=inicio)
        .exists()
    )
    return not hay_cruce


#: Cada cuántos minutos se ofrece un hueco al cliente. 15 es el paso con
#: que la gente piensa las citas ("y cuarto", "y media"); ofrecer cada 5
#: llenaría la pantalla de opciones que dicen lo mismo.
PASO_HUECOS_MINUTOS = 15


def huecos_disponibles(*, negocio, servicio, fecha, ahora=None):
    """Las horas a las que un cliente puede reservar `servicio` ese día.

    Devuelve datetimes de inicio, sin decir con quién: el cliente elige la
    hora y `agendar_cita` resuelve el empleado. Un hueco existe si **al
    menos un** empleado activo puede atenderlo completo.

    Está escrito para no hacer N+1. Es el único endpoint público que no se
    puede cachear —cambia cada vez que alguien reserva— así que carga los
    horarios y las citas del día de una vez y cruza en memoria, en lugar
    de llamar a `empleado_disponible` por cada combinación de hueco y
    empleado (que para un día de 9 horas y 5 empleados serían ~360
    consultas por request).

    `ahora` se inyecta para poder testear el filtrado de horas pasadas sin
    depender del reloj.
    """
    duracion = timedelta(minutes=servicio.duracion_minutos)
    dia_semana = fecha.weekday()
    ahora = ahora or timezone.now()

    miembros = list(negocio.miembros.filter(activo=True))
    if not miembros:
        return []

    # Un solo query por cosa, en vez de uno por empleado.
    propias = {}
    for horario in HorarioTrabajo.objects.filter(miembro__in=miembros):
        propias.setdefault(horario.miembro_id, []).append(horario)

    del_negocio = [
        horario
        for horario in HorarioNegocio.objects.filter(negocio=negocio)
        if horario.dia_semana == dia_semana
    ]

    inicio_dia = timezone.make_aware(datetime.combine(fecha, time.min))
    fin_dia = inicio_dia + timedelta(days=1)
    ocupacion = {}
    for cita in (
        Cita.objects.filter(negocio=negocio)
        .exclude(estado__in=ESTADOS_LIBERAN_CUPO)
        .filter(fecha_hora_inicio__lt=fin_dia, fecha_hora_fin__gt=inicio_dia)
    ):
        ocupacion.setdefault(cita.empleado_id, []).append(cita)

    huecos = set()
    for miembro in miembros:
        # Misma regla de herencia que `_franjas_vigentes`, resuelta acá
        # sobre los datos ya cargados: tener horario propio en cualquier
        # día del mes hace que el del negocio no aplique.
        vigentes = (
            [h for h in propias[miembro.id] if h.dia_semana == dia_semana]
            if miembro.id in propias
            else del_negocio
        )
        citas = ocupacion.get(miembro.id, [])

        for franja in vigentes:
            momento = timezone.make_aware(datetime.combine(fecha, franja.hora_inicio))
            cierre = timezone.make_aware(datetime.combine(fecha, franja.hora_fin))
            while momento + duracion <= cierre:
                fin = momento + duracion
                libre = not any(
                    cita.fecha_hora_inicio < fin and cita.fecha_hora_fin > momento
                    for cita in citas
                )
                if libre and momento > ahora:
                    huecos.add(momento)
                momento += timedelta(minutes=PASO_HUECOS_MINUTOS)

    return sorted(huecos)


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
    """Mueve la cita por su máquina de estados.

    **No acepta `completada`**: completar tiene un efecto de negocio
    (genera la venta) y por eso vive en `completar_cita`. Dejar que esta
    función lo hiciera abriría un camino por el que una cita queda
    completada sin cuenta que cobrar — exactamente el agujero que el
    rediseño del módulo de dinero vino a cerrar.
    """
    if nuevo_estado == Cita.Estado.COMPLETADA:
        raise TransicionEstadoInvalida(
            "Para completar una cita usa `completar_cita`: completar genera la "
            "venta que después se cobra."
        )

    transiciones_permitidas = TRANSICIONES_VALIDAS[cita.estado]
    if nuevo_estado not in transiciones_permitidas:
        raise TransicionEstadoInvalida(
            f"No se puede pasar de '{cita.estado}' a '{nuevo_estado}'."
        )
    cita.estado = nuevo_estado
    cita.save(update_fields=["estado", "actualizado_en"])
    return cita


@transaction.atomic
def completar_cita(*, cita, responsable):
    """El empleado terminó el trabajo: la cita se completa y **nace la
    venta pendiente de cobro**.

    Es el punto donde se cruzan agenda y dinero, y el que reemplaza al
    viejo "registrar servicio" a mano: el barbero pulsa Completar y la
    cuenta le aparece sola a recepción. El barbero no toca plata; su
    responsabilidad termina acá.

    **Idempotente por diseño.** Dos toques al botón, o un reintento por
    red mala en un local comercial, no pueden generar dos cuentas para el
    mismo cliente. Tres capas, de más amable a más terminante:

    1. si la cita ya tiene venta, se devuelve esa misma sin crear nada;
    2. `select_for_update` sobre la cita serializa dos requests
       simultáneos, de modo que el segundo lee el estado ya escrito por el
       primero en vez de decidir sobre datos viejos;
    3. el `OneToOne` de `Venta.cita` en la base es la garantía final.

    Devuelve `(cita, venta)`.
    """
    # Import local y no en la cabecera: `apps.caja.models.Venta` apunta a
    # `agenda.Cita`, y aunque hoy lo hace por string (así que no hay ciclo
    # real), importar caja desde acá arriba deja a las dos apps
    # acopladas en tiempo de carga sin necesidad. Agenda depende de caja
    # en **una** función, y así se ve.
    from apps.caja import services as caja_services
    from apps.caja.models import Venta

    # Relee bajo lock: sin esto, dos requests concurrentes evalúan el
    # `hasattr` de abajo contra el mismo estado previo y los dos crean.
    cita = Cita.objects.select_for_update().select_related("servicio", "empleado").get(pk=cita.pk)

    venta_existente = Venta.objects.filter(cita=cita).first()
    if venta_existente is not None:
        return cita, venta_existente

    if cita.estado not in (Cita.Estado.CONFIRMADA, Cita.Estado.EN_ATENCION, Cita.Estado.AGENDADA):
        raise CitaNoCompletable(
            f"Una cita '{cita.get_estado_display().lower()}' no se puede completar."
        )

    venta = caja_services.crear_venta(
        negocio=cita.negocio,
        creada_por=responsable,
        cita=cita,
        nombre_cliente=cita.nombre_cliente,
        telefono_cliente=cita.telefono_cliente,
        items=[{"servicio": cita.servicio, "empleado": cita.empleado}],
    )

    cita.estado = Cita.Estado.COMPLETADA
    cita.save(update_fields=["estado", "actualizado_en"])
    return cita, venta
