from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import TieneMembresiaActiva, requiere_capacidad
from apps.servicios import services
from apps.servicios.models import RegistroServicio, Servicio
from apps.servicios.serializers import (
    RechazoSerializer,
    RegistroServicioSerializer,
    ServicioLoteSerializer,
    ServicioSerializer,
)


class ServicioViewSet(viewsets.ModelViewSet):
    """CRUD de servicios del negocio del usuario autenticado.

    Leer requiere solo pertenecer al negocio; crear/editar/borrar
    requiere la capacidad `puede_editar_precios`, porque un servicio
    define precio y comisión.
    """

    serializer_class = ServicioSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
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


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "estado",
                str,
                required=False,
                enum=[estado.value for estado in RegistroServicio.Estado],
                description="Filtra por estado. Sin este parámetro, devuelve todos.",
            ),
            OpenApiParameter(
                "fecha_desde",
                str,
                required=False,
                description="Filtra desde esta fecha, inclusive (YYYY-MM-DD).",
            ),
            OpenApiParameter(
                "fecha_hasta",
                str,
                required=False,
                description="Filtra hasta esta fecha, inclusive (YYYY-MM-DD).",
            ),
            OpenApiParameter(
                "empleado",
                int,
                required=False,
                description=(
                    "Filtra por quién lo registró. Sin `puede_aprobar_servicios` no "
                    "tiene efecto útil: el listado ya está acotado a uno mismo."
                ),
            ),
        ],
    ),
)
class RegistroServicioViewSet(viewsets.ModelViewSet):
    """Registro y validación de servicios realizados.

    Crear no exige ninguna capacidad: cualquier miembro activo puede
    registrar un servicio. Sin `puede_aprobar_servicios`, siempre es **el
    suyo propio** — `empleado` sale de la membresía del token, nunca del
    body (ver `perform_create`), para que nadie registre trabajo a
    nombre de otro. Con esa capacidad, en cambio, elegir `empleado` es
    **obligatorio**: alguien que administra el negocio puede estar
    cargando el trabajo de un barbero que no usa la app, y el registro
    tiene que quedar asociado a quien de verdad lo hizo, no a quien lo
    tipeó (ver `RegistroServicioSerializer.validate`).

    Listar devuelve solo los propios salvo que se tenga
    `puede_aprobar_servicios`, que ve los de todo el negocio, con
    `?estado=`, `?fecha_desde=`/`?fecha_hasta=` y `?empleado=` opcionales
    para filtrar. Aprobar y rechazar exigen esa misma capacidad, sin
    excepción de propiedad: a diferencia de `Cita`, acá nadie revisa lo
    suyo aunque tenga el permiso (ver `services._validar_revision`) —
    incluye a quien registró a nombre de otro y luego se pone a sí mismo
    como empleado: sigue sin poder aprobarse.

    Inmutable tras crearse: sin `PUT`/`PATCH`/`DELETE`. La única forma de
    que un registro cambie es a través de `aprobar`/`rechazar`, que dejan
    su propio rastro de auditoría.
    """

    http_method_names = ["get", "post", "head", "options"]
    serializer_class = RegistroServicioSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_aprobar_servicios")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return RegistroServicio.objects.none()

        membresia = self.request.membresia
        registros = membresia.negocio.registros_servicio.select_related(
            "empleado__usuario", "servicio", "aprobado_por__usuario"
        )
        if not membresia.tiene("puede_aprobar_servicios"):
            # Sin la capacidad, un registro ajeno responde 404, igual que
            # uno inexistente (CONTRATO.md 5.2) — mismo criterio que la
            # agenda propia en `CitaViewSet.get_queryset`.
            registros = registros.filter(empleado=membresia)

        params = self.request.query_params
        estado = params.get("estado")
        if estado:
            registros = registros.filter(estado=estado)
        fecha_desde = params.get("fecha_desde")
        if fecha_desde:
            registros = registros.filter(fecha_hora__date__gte=fecha_desde)
        fecha_hasta = params.get("fecha_hasta")
        if fecha_hasta:
            registros = registros.filter(fecha_hora__date__lte=fecha_hasta)
        empleado_id = params.get("empleado")
        if empleado_id:
            registros = registros.filter(empleado_id=empleado_id)
        return registros

    def perform_create(self, serializer):
        solicitante = self.request.membresia
        empleado = (
            serializer.validated_data["empleado"]
            if solicitante.tiene("puede_aprobar_servicios")
            else solicitante
        )
        try:
            registro = services.registrar_servicio(
                negocio=solicitante.negocio,
                empleado=empleado,
                servicio=serializer.validated_data["servicio"],
                nombre_cliente=serializer.validated_data["nombre_cliente"],
                telefono_cliente=serializer.validated_data.get("telefono_cliente", ""),
                fecha_hora=serializer.validated_data["fecha_hora"],
                observaciones=serializer.validated_data.get("observaciones", ""),
                evidencia=serializer.validated_data.get("evidencia"),
            )
        except services.FechaFutura as error:
            raise drf_serializers.ValidationError({"fecha_hora": [str(error)]})
        serializer.instance = registro

    def _revisar(self, request, accion):
        registro = self.get_object()
        try:
            if accion == "aprobar":
                registro = services.aprobar_registro(
                    registro=registro, revisor=request.membresia
                )
            else:
                entrada = RechazoSerializer(data=request.data)
                entrada.is_valid(raise_exception=True)
                registro = services.rechazar_registro(
                    registro=registro,
                    revisor=request.membresia,
                    motivo=entrada.validated_data["motivo"],
                )
        except (
            services.RegistroYaRevisado,
            services.NoPuedeAutoaprobarse,
            services.MotivoRechazoRequerido,
        ) as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})
        return Response(RegistroServicioSerializer(registro, context={"request": request}).data)

    @extend_schema(request=None, responses={200: RegistroServicioSerializer})
    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        return self._revisar(request, "aprobar")

    @extend_schema(request=RechazoSerializer, responses={200: RegistroServicioSerializer})
    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        return self._revisar(request, "rechazar")
