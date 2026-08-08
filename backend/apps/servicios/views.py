from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import (
    TieneMembresiaActiva,
    requiere_alguna_capacidad,
    requiere_capacidad,
)
from apps.servicios import services
from apps.servicios.models import Servicio
from apps.servicios.serializers import ServicioLoteSerializer, ServicioSerializer


class ServicioViewSet(viewsets.ModelViewSet):
    """CRUD de servicios del negocio del usuario autenticado.

    Leer requiere solo pertenecer al negocio. Crear/borrar (y el alta en
    lote) requieren `puede_editar_precios` — un servicio nuevo siempre
    define un precio, así que no tiene sentido crear uno sin esa
    capacidad. Editar (`update`/`partial_update`) es más laxo: alcanza
    con `puede_editar_precios` **o** `puede_editar_comisiones`, porque un
    `PATCH` puede tocar solo el precio o solo el `porcentaje_comision` —
    quién puede cambiar cuál de los dos, en el detalle, lo decide
    `ServicioSerializer.validate()`.
    """

    serializer_class = ServicioSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
        if self.action in ("update", "partial_update"):
            return [requiere_alguna_capacidad("puede_editar_precios", "puede_editar_comisiones")()]
        return [requiere_capacidad("puede_editar_precios")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Servicio.objects.none()
        return self.request.membresia.negocio.servicios.all()

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.membresia.tenant, negocio=self.request.membresia.negocio
        )

    @extend_schema(
        request=ServicioLoteSerializer,
        responses={201: ServicioSerializer(many=True)},
        description=(
            "Crea varios servicios en una sola transacción: entran todos o "
            "ninguno.\n\n"
            "Pensado para el alta desde catálogo del frontend, que antes "
            "emitía un POST por servicio y podía quedar a medias si fallaba "
            "la red."
        ),
    )
    @action(detail=False, methods=["post"], url_path="lote")
    def lote(self, request):
        entrada = ServicioLoteSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)

        creados = services.crear_servicios_en_lote(
            negocio=request.membresia.negocio,
            servicios=entrada.validated_data["servicios"],
        )

        return Response(
            ServicioSerializer(creados, many=True).data, status=status.HTTP_201_CREATED
        )
