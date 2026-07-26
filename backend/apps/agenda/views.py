from drf_spectacular.utils import extend_schema
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.agenda import services
from apps.agenda.models import Cita, HorarioTrabajo
from apps.agenda.serializers import (
    CitaCreateSerializer,
    CitaSerializer,
    HorarioSemanalSerializer,
    HorarioTrabajoSerializer,
)
from apps.common.permissions import (
    TieneMembresiaActiva,
    requiere_capacidad,
    requiere_capacidad_o_ser_titular,
)


class HorarioTrabajoViewSet(viewsets.ModelViewSet):
    """Horario semanal recurrente de los empleados del negocio."""

    serializer_class = HorarioTrabajoSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_gestionar_agenda")()]

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
            "Reemplaza de una vez el horario semanal completo de un empleado, "
            "en una sola transacción.\n\n"
            "Semántica de **reemplazo**: las franjas enviadas pasan a ser el "
            "horario completo del empleado; lo que no venga en la lista se "
            "borra. Enviar `franjas: []` lo deja sin disponibilidad.\n\n"
            "Existe para que el frontend no tenga que emitir un DELETE/POST "
            "por franja al editar la semana, que no era atómico."
        ),
    )
    @action(detail=False, methods=["put"], url_path="semana")
    def semana(self, request):
        entrada = HorarioSemanalSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)

        try:
            horarios = services.reemplazar_horario_semanal(
                miembro=entrada.validated_data["miembro"],
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
        return self.request.membresia.negocio.citas.select_related(
            "servicio", "empleado__usuario"
        ).all()

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
