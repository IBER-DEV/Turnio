from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework import serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.caja import services
from apps.caja.models import Caja
from apps.caja.serializers import (
    AbrirCajaSerializer,
    CajaDetalleSerializer,
    CajaListaSerializer,
    CerrarCajaSerializer,
    MovimientoCajaSerializer,
)
from apps.common.permissions import requiere_alguna_capacidad, requiere_capacidad


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "fecha_desde",
                str,
                required=False,
                description="Filtra desde esta fecha, inclusive (YYYY-MM-DD), sobre cuándo se abrió la caja.",
            ),
            OpenApiParameter(
                "fecha_hasta",
                str,
                required=False,
                description="Filtra hasta esta fecha, inclusive (YYYY-MM-DD), sobre cuándo se abrió la caja.",
            ),
        ],
    ),
)
class CajaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """La caja del negocio: histórico, apertura, movimientos y cierre.

    Leer (`list`/`retrieve`, el histórico) exige `puede_cobrar` **o**
    `puede_ver_reportes` — cualquiera de las dos alcanza, porque quien
    opera la caja del día necesita poder mirar cierres pasados para
    cuadrar, y quien solo ve reportes también. Abrir, cerrar y registrar
    movimientos exigen `puede_cobrar` sin excepción.
    """

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [requiere_alguna_capacidad("puede_cobrar", "puede_ver_reportes")()]
        return [requiere_capacidad("puede_cobrar")()]

    def get_serializer_class(self):
        return CajaListaSerializer if self.action == "list" else CajaDetalleSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Caja.objects.none()

        qs = self.request.membresia.negocio.cajas.select_related(
            "abierta_por__usuario", "cerrada_por__usuario"
        ).prefetch_related(
            "movimientos__registrado_por__usuario", "movimientos__empleado_comision__usuario"
        )
        params = self.request.query_params
        fecha_desde = params.get("fecha_desde")
        if fecha_desde:
            qs = qs.filter(abierta_en__date__gte=fecha_desde)
        fecha_hasta = params.get("fecha_hasta")
        if fecha_hasta:
            qs = qs.filter(abierta_en__date__lte=fecha_hasta)
        return qs

    @extend_schema(responses={200: CajaDetalleSerializer})
    @action(detail=False, methods=["get"])
    def actual(self, request):
        caja = services.caja_abierta_de(request.membresia.negocio)
        if caja is None:
            return Response({"detail": "No hay ninguna caja abierta."}, status=status.HTTP_404_NOT_FOUND)
        return Response(CajaDetalleSerializer(caja, context={"request": request}).data)

    @extend_schema(request=AbrirCajaSerializer, responses={201: CajaDetalleSerializer})
    @action(detail=False, methods=["post"])
    def abrir(self, request):
        entrada = AbrirCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            caja = services.abrir_caja(
                negocio=request.membresia.negocio,
                responsable=request.membresia,
                saldo_inicial=entrada.validated_data["saldo_inicial"],
            )
        except services.YaHayCajaAbierta as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})
        return Response(
            CajaDetalleSerializer(caja, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=CerrarCajaSerializer, responses={200: CajaDetalleSerializer})
    @action(detail=False, methods=["post"])
    def cerrar(self, request):
        caja = services.caja_abierta_de(request.membresia.negocio)
        if caja is None:
            raise drf_serializers.ValidationError(
                {"non_field_errors": ["No hay ninguna caja abierta."]}
            )
        entrada = CerrarCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            caja = services.cerrar_caja(
                caja=caja,
                responsable=request.membresia,
                nota_cierre=entrada.validated_data["nota_cierre"],
            )
        except services.NoHayCajaAbierta as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})
        return Response(CajaDetalleSerializer(caja, context={"request": request}).data)

    @extend_schema(request=MovimientoCajaSerializer, responses={201: MovimientoCajaSerializer})
    @action(detail=False, methods=["post"])
    def movimientos(self, request):
        caja = services.caja_abierta_de(request.membresia.negocio)
        if caja is None:
            raise drf_serializers.ValidationError(
                {"non_field_errors": ["No hay ninguna caja abierta. Ábrela antes de registrar movimientos."]}
            )
        entrada = MovimientoCajaSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)
        try:
            movimiento = services.registrar_movimiento(
                caja=caja,
                registrado_por=request.membresia,
                tipo=entrada.validated_data["tipo"],
                monto=entrada.validated_data["monto"],
                concepto=entrada.validated_data["concepto"],
                metodo_pago=entrada.validated_data.get("metodo_pago", ""),
                registro_servicio=entrada.validated_data.get("registro_servicio"),
                empleado_comision=entrada.validated_data.get("empleado_comision"),
            )
        except (services.RegistroServicioNoAprobado, services.RegistroServicioYaVinculado) as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})
        return Response(
            MovimientoCajaSerializer(movimiento, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
