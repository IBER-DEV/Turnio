"""La cara pública de Turnio: lo que ve un cliente sin sesión.

Todo acá es `AllowAny`, lo que lo convierte en la superficie más expuesta
del proyecto. Tres reglas que aplican a cada vista de este módulo:

1. **Solo negocios activos.** Un negocio dado de baja desaparece de
   internet, no queda accesible por URL directa.
2. **Nunca datos de clientes.** Las citas existentes solo se usan para
   descartar huecos ocupados; jamás se devuelven. Quien pregunta por la
   disponibilidad de un local no puede deducir quién tiene cita.
3. **Throttling en todo.** Sin sesión no hay a quién responsabilizar, así
   que el límite es por IP (ver `settings.REST_FRAMEWORK`).
"""

from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework import serializers as drf_serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.agenda import services as agenda_services
from apps.negocios.models import Negocio
from apps.publico.serializers import (
    DisponibilidadConsultaSerializer,
    HuecoSerializer,
    NegocioPublicoResumenSerializer,
    NegocioPublicoSerializer,
    ReservaConfirmadaSerializer,
    ReservaSerializer,
)
from apps.servicios.models import Servicio
from apps.usuarios.models import MiembroNegocio


def _negocio_publico(slug):
    """El negocio de ese slug, o 404 si no existe o está inactivo."""
    return generics.get_object_or_404(Negocio, slug=slug, activo=True)


@extend_schema(
    parameters=[
        OpenApiParameter("q", str, description="Busca en el nombre del negocio."),
        OpenApiParameter("ciudad", str, description="Filtra por ciudad."),
    ],
    responses={200: NegocioPublicoResumenSerializer(many=True)},
    description=(
        "Busca negocios para reservar. Público, sin autenticación.\n\n"
        "Devuelve solo negocios activos. Sin parámetros lista todos, que "
        "hoy es razonable por el volumen; cuando crezca habrá que paginar."
    ),
)
class BuscarNegociosView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = NegocioPublicoResumenSerializer
    throttle_scope = "publico_lectura"

    def get_queryset(self):
        negocios = Negocio.objects.filter(activo=True)
        q = self.request.query_params.get("q", "").strip()
        ciudad = self.request.query_params.get("ciudad", "").strip()
        if q:
            negocios = negocios.filter(Q(nombre__icontains=q))
        if ciudad:
            negocios = negocios.filter(ciudad__iexact=ciudad)
        return negocios.order_by("nombre")


@extend_schema(
    responses={200: NegocioPublicoSerializer},
    description=(
        "El perfil público de un negocio: sus servicios, quién atiende y su "
        "horario. Público, sin autenticación.\n\n"
        "Esta respuesta es **cacheable**: cambia solo cuando el negocio "
        "edita su catálogo, su equipo o su horario. La disponibilidad, que "
        "cambia con cada reserva, vive en un endpoint aparte a propósito."
    ),
)
class PerfilNegocioView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = NegocioPublicoSerializer
    throttle_scope = "publico_lectura"
    lookup_field = "slug"

    def get_queryset(self):
        return Negocio.objects.filter(activo=True).prefetch_related(
            "servicios",
            "horarios",
            "fotos",
            Prefetch("miembros", queryset=MiembroNegocio.objects.select_related("usuario")),
        )


@extend_schema(
    parameters=[
        OpenApiParameter("servicio", int, required=True, description="Id del servicio."),
        OpenApiParameter("fecha", str, required=True, description="Día a consultar (YYYY-MM-DD)."),
    ],
    responses={200: HuecoSerializer(many=True)},
    description=(
        "Las horas libres para un servicio en un día. Público, sin "
        "autenticación.\n\n"
        "**No cachear**: cambia con cada reserva. Devuelve solo horas "
        "futuras, y nunca revela quién está ocupado ni con quién — las "
        "citas existentes se usan para descartar huecos y nada más."
    ),
)
class DisponibilidadView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "publico_lectura"

    def get(self, request, slug):
        negocio = _negocio_publico(slug)
        consulta = DisponibilidadConsultaSerializer(data=request.query_params)
        consulta.is_valid(raise_exception=True)

        servicio = generics.get_object_or_404(
            Servicio, pk=consulta.validated_data["servicio"], negocio=negocio, activo=True
        )
        huecos = agenda_services.huecos_disponibles(
            negocio=negocio, servicio=servicio, fecha=consulta.validated_data["fecha"]
        )
        return Response([{"inicio": inicio} for inicio in huecos])


@extend_schema(
    request=ReservaSerializer,
    responses={201: ReservaConfirmadaSerializer},
    description=(
        "Reserva una cita sin necesidad de cuenta: basta nombre y teléfono. "
        "Es el reemplazo directo de llamar o escribir por WhatsApp.\n\n"
        "`empleado` es opcional: si se omite, se asigna quien esté "
        "disponible. Si el hueco se ocupó entre que se mostró y se confirmó "
        "—dos clientes reservando a la vez— responde `400`, no una cita "
        "encima de otra."
    ),
)
class ReservarView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "publico_reserva"

    def post(self, request, slug):
        negocio = _negocio_publico(slug)
        entrada = ReservaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        servicio = generics.get_object_or_404(
            Servicio, pk=datos["servicio"], negocio=negocio, activo=True
        )
        empleado = None
        if datos["empleado"] is not None:
            empleado = generics.get_object_or_404(
                negocio.miembros, pk=datos["empleado"], activo=True
            )

        try:
            cita = agenda_services.agendar_cita(
                negocio=negocio,
                servicio=servicio,
                empleado=empleado,
                fecha_hora_inicio=datos["fecha_hora_inicio"],
                nombre_cliente=datos["nombre_cliente"],
                telefono_cliente=datos["telefono_cliente"],
                notas=datos["notas"],
            )
        except agenda_services.SinDisponibilidad:
            # Mensaje genérico a propósito: "ese horario ya se ocupó" no
            # debe distinguirse de "ese horario nunca estuvo disponible",
            # o la respuesta se vuelve un oráculo de la agenda del local.
            raise drf_serializers.ValidationError(
                {"non_field_errors": ["Ese horario ya no está disponible. Elige otro."]}
            )

        return Response(
            {
                "negocio": negocio.nombre,
                "servicio": servicio.nombre,
                "profesional": cita.empleado.usuario.nombre,
                "fecha_hora_inicio": cita.fecha_hora_inicio,
                "fecha_hora_fin": cita.fecha_hora_fin,
                "nombre_cliente": cita.nombre_cliente,
            },
            status=status.HTTP_201_CREATED,
        )
