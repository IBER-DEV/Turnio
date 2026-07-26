from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.agenda import services
from apps.agenda.models import Cita, HorarioTrabajo
from apps.agenda.serializers import (
    CitaCreateSerializer,
    CitaSerializer,
    HorarioNegocioSemanalSerializer,
    HorarioNegocioSerializer,
    HorarioSemanalSerializer,
    HorarioTrabajoSerializer,
)
from apps.common.permissions import (
    TieneMembresiaActiva,
    requiere_capacidad,
    requiere_capacidad_o_ser_titular,
)


@extend_schema_view(
    get=extend_schema(
        responses={200: HorarioNegocioSerializer(many=True)},
        description=(
            "Horario de atención del negocio del usuario autenticado.\n\n"
            "Es el horario que rige por defecto para todo el equipo: quien no "
            "tenga horario propio cargado trabaja este. Lo puede leer cualquier "
            "miembro."
        ),
    ),
    put=extend_schema(
        request=HorarioNegocioSemanalSerializer,
        responses={200: HorarioNegocioSerializer(many=True)},
        description=(
            "Reemplaza el horario de atención del negocio en una sola "
            "transacción. Requiere `puede_configurar_horarios` — decidir "
            "cuándo abre el local es una decisión distinta de operar la "
            "agenda del día.\n\n"
            "Cambiarlo acá cambia la disponibilidad de **todos** los empleados "
            "que lo heredan, que es el caso normal. Los que tienen horario "
            "propio (ver `PUT /api/agenda/horarios/semana/`) no se ven "
            "afectados.\n\n"
            "Semántica de **reemplazo**: las franjas enviadas pasan a ser el "
            "horario completo; lo que no venga se borra. Enviar `franjas: []` "
            "deja al negocio sin horario, y entonces nadie que herede tiene "
            "disponibilidad."
        ),
    ),
)
class HorarioNegocioView(APIView):
    """Horario de atención del negocio: la fuente de verdad de la agenda.

    El negocio nunca viaja en el body — sale de la membresía del token,
    como todo lo demás (ver `CONTRATO.md` sección 5.5).
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_configurar_horarios")()]

    def get(self, request):
        horarios = request.membresia.negocio.horarios.all()
        return Response(HorarioNegocioSerializer(horarios, many=True).data)

    def put(self, request):
        entrada = HorarioNegocioSemanalSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        try:
            horarios = services.reemplazar_horario_negocio(
                negocio=request.membresia.negocio,
                franjas=entrada.validated_data["franjas"],
            )
        except (services.HorarioInvalido, services.FranjasSolapadas) as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})

        return Response(HorarioNegocioSerializer(horarios, many=True).data)


class HorarioTrabajoViewSet(viewsets.ModelViewSet):
    """Horario propio de un empleado, como excepción al del negocio.

    Escribir requiere `puede_configurar_horarios`, no
    `puede_gestionar_agenda`: decidir cuándo trabaja alguien es una
    decisión distinta de operar la agenda del día (ver `CONTRATO.md`
    sección 5.8).
    """

    serializer_class = HorarioTrabajoSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_configurar_horarios")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return HorarioTrabajo.objects.none()
        return HorarioTrabajo.objects.filter(
            miembro__negocio=self.request.membresia.negocio
        ).select_related("miembro")

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.membresia.tenant)

    @extend_schema(
        request=HorarioSemanalSerializer,
        responses={200: HorarioTrabajoSerializer(many=True)},
        description=(
            "Reemplaza el horario **propio** de uno o varios empleados, en una "
            "sola transacción.\n\n"
            "El horario propio es la **excepción** al horario del negocio (ver "
            "`PUT /api/agenda/horario-negocio/`), para quien no trabaja como el "
            "resto: medio tiempo, solo sábados, turno de tarde. Si un empleado "
            "no tiene horario propio, hereda el del negocio — que es el caso "
            "normal y no requiere llamar a este endpoint.\n\n"
            "`miembros` es una lista porque los de medio tiempo suelen "
            "compartir turno. Un solo empleado es el caso `miembros: [id]`.\n\n"
            "Semántica de **reemplazo**: las franjas enviadas pasan a ser el "
            "horario propio completo de **cada** empleado señalado. Enviar "
            "`franjas: []` le quita el horario propio y lo devuelve a heredar "
            "el del negocio; para que alguien no atienda, la palanca es "
            "`activo=False` en su membresía, no un horario vacío.\n\n"
            "Todo o nada: si la semana es inválida, o si alguno de los "
            "`miembros` no pertenece al negocio, responde `400` y no se toca el "
            "horario de nadie."
        ),
    )
    @action(detail=False, methods=["put"], url_path="semana")
    def semana(self, request):
        entrada = HorarioSemanalSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)

        try:
            horarios = services.reemplazar_horario_semanal(
                miembros=entrada.validated_data["miembros"],
                franjas=entrada.validated_data["franjas"],
            )
        except (services.HorarioInvalido, services.FranjasSolapadas) as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})

        return Response(HorarioTrabajoSerializer(horarios, many=True).data)


class CitaViewSet(viewsets.ModelViewSet):
    """Agenda: crear y consultar citas, y transicionar su estado.

    Crear requiere `puede_gestionar_agenda`. `empleado` es opcional al
    crear: si se omite, el servicio de agenda asigna automáticamente el
    primer empleado disponible ("cualquiera disponible").

    Transicionar (`confirmar`/`completar`/`cancelar`) lo puede hacer quien
    tenga `puede_gestionar_agenda` sobre **cualquier** cita del negocio, o
    cualquier miembro sobre **sus propias** citas: marcar que el cliente
    llegó no es un acto administrativo, es el empleado haciendo su
    trabajo. Ver `CONTRATO.md` sección 5.6.

    Listar devuelve solo las citas propias salvo que se tenga
    `puede_ver_agenda_completa`: cada cita trae nombre y teléfono del
    cliente, así que la agenda completa **es** la libreta de clientes del
    negocio (ver `CONTRATO.md` sección 5.8).
    """

    serializer_class = CitaSerializer

    # Transiciones de estado: la propiedad de la cita habilita por sí sola.
    ACCIONES_DE_ESTADO = ("confirmar", "completar", "cancelar")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
        if self.action in self.ACCIONES_DE_ESTADO:
            return [requiere_capacidad_o_ser_titular("puede_gestionar_agenda", "empleado")()]
        # Crear/editar/borrar sigue siendo administración de la agenda del
        # negocio: no hay "cita propia" que justifique crearla uno mismo.
        return [requiere_capacidad("puede_gestionar_agenda")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Cita.objects.none()

        membresia = self.request.membresia
        citas = membresia.negocio.citas.select_related("servicio", "empleado__usuario")
        if membresia.puede_ver_agenda_completa:
            return citas.all()
        # Acota también `retrieve` y las transiciones: una cita ajena
        # responde 404, igual que una inexistente (CONTRATO.md 5.2).
        return citas.filter(empleado=membresia)

    @extend_schema(request=CitaCreateSerializer, responses={201: CitaSerializer})
    def create(self, request, *args, **kwargs):
        entrada = CitaCreateSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        try:
            cita = services.agendar_cita(
                negocio=request.membresia.negocio,
                servicio=datos["servicio"],
                empleado=datos["empleado"],
                fecha_hora_inicio=datos["fecha_hora_inicio"],
                nombre_cliente=datos["nombre_cliente"],
                telefono_cliente=datos["telefono_cliente"],
                notas=datos["notas"],
            )
        except services.SinDisponibilidad as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})

        return Response(CitaSerializer(cita).data, status=status.HTTP_201_CREATED)

    def _transicionar(self, request, nuevo_estado):
        cita = self.get_object()
        try:
            cita = services.cambiar_estado_cita(cita=cita, nuevo_estado=nuevo_estado)
        except services.TransicionEstadoInvalida as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})
        return Response(CitaSerializer(cita).data)

    @extend_schema(request=None, responses={200: CitaSerializer})
    @action(detail=True, methods=["post"])
    def confirmar(self, request, pk=None):
        return self._transicionar(request, "confirmada")

    @extend_schema(request=None, responses={200: CitaSerializer})
    @action(detail=True, methods=["post"])
    def completar(self, request, pk=None):
        return self._transicionar(request, "completada")

    @extend_schema(request=None, responses={200: CitaSerializer})
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        return self._transicionar(request, "cancelada")
