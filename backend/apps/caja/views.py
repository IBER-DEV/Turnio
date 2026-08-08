from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework import serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.caja import services
from apps.caja.models import Caja, Venta
from apps.caja.serializers import (
    AbrirCajaSerializer,
    AnularVentaSerializer,
    CajaDetalleSerializer,
    CajaListaSerializer,
    CerrarCajaSerializer,
    CobrarSerializer,
    DevolverSerializer,
    EgresoSerializer,
    MovimientoCajaSerializer,
    VentaSerializer,
)
from apps.common.permissions import (
    TieneMembresiaActiva,
    requiere_alguna_capacidad,
    requiere_capacidad,
)

#: Errores de negocio de `apps.caja.services` que la API traduce a un 400
#: con mensaje legible. Se enumeran juntos porque la alternativa —un
#: `except` distinto por acción— hacía que agregar un error nuevo al
#: dominio devolviera un 500 hasta que alguien se acordara de atraparlo.
ERRORES_DE_NEGOCIO = (
    services.ArqueoRequerido,
    services.MontoExcedeLoPagado,
    services.MontoExcedeSaldo,
    services.MotivoRequerido,
    services.NoHayCajaAbierta,
    services.RecursoDeOtroNegocio,
    services.VentaNoCobrable,
    services.VentaSinItems,
    services.VentaYaAnulada,
    services.YaHayCajaAbierta,
)


def _traducir(error):
    return drf_serializers.ValidationError({"non_field_errors": [str(error)]})


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
    """La jornada de caja: histórico, apertura, egresos y cierre con arqueo.

    Leer (`list`/`retrieve`) exige `puede_cobrar` **o**
    `puede_ver_reportes` — cualquiera de las dos alcanza, porque quien
    opera la caja del día necesita mirar cierres pasados para cuadrar, y
    quien solo ve reportes también. Abrir, cerrar y registrar egresos
    exigen `puede_cobrar` sin excepción.

    Los **ingresos** no se crean acá: entran cobrando una venta
    (`POST /api/caja/ventas/{id}/cobrar/`). Es la regla central del
    módulo — la plata que entra siempre tiene una cuenta que la explica.
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
        ).prefetch_related("movimientos__registrado_por__usuario")
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
            return Response(
                {"detail": "No hay ninguna caja abierta."}, status=status.HTTP_404_NOT_FOUND
            )
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
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        return Response(
            CajaDetalleSerializer(caja, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=CerrarCajaSerializer,
        responses={200: CajaDetalleSerializer},
        description=(
            "Cierra la caja con arqueo. `efectivo_contado` es obligatorio.\n\n"
            "El esperado se calcula **solo con efectivo**: saldo inicial + "
            "ingresos en efectivo − egresos en efectivo − devoluciones en "
            "efectivo. Tarjeta y transferencias no pasan por el cajón y se "
            "concilian aparte (ver `resumen.por_metodo_pago`).\n\n"
            "Una diferencia negativa (faltante) **no bloquea** el cierre: "
            "queda registrada y auditada."
        ),
    )
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
                efectivo_contado=entrada.validated_data["efectivo_contado"],
                nota_cierre=entrada.validated_data["nota_cierre"],
            )
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        return Response(CajaDetalleSerializer(caja, context={"request": request}).data)

    @extend_schema(
        request=EgresoSerializer,
        responses={201: MovimientoCajaSerializer},
        description=(
            "Registra plata que sale por un gasto del negocio (insumos, "
            "arriendo, domicilio). No tiene venta asociada por diseño, y es "
            "distinto de una devolución a un cliente — que se hace desde la "
            "venta y tiene su propio tipo de movimiento."
        ),
    )
    @action(detail=False, methods=["post"])
    def egresos(self, request):
        entrada = EgresoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            movimiento = services.registrar_egreso(
                negocio=request.membresia.negocio,
                registrado_por=request.membresia,
                **entrada.validated_data,
            )
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        return Response(
            MovimientoCajaSerializer(movimiento, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "estado",
                str,
                required=False,
                enum=[estado.value for estado in Venta.Estado],
                description=(
                    "Filtra por estado. `?estado=pendiente` es la **cola de "
                    "cobro** de recepción."
                ),
            ),
            OpenApiParameter(
                "fecha_desde", str, required=False, description="YYYY-MM-DD, inclusive."
            ),
            OpenApiParameter(
                "fecha_hasta", str, required=False, description="YYYY-MM-DD, inclusive."
            ),
            OpenApiParameter(
                "empleado",
                int,
                required=False,
                description="Filtra por quién realizó alguna de las líneas.",
            ),
        ],
    ),
)
class VentaViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Las cuentas del negocio: qué se debe, qué se cobró.

    Reemplaza al viejo `POST /api/servicios/registros/` y a su circuito de
    aprobación. La regla que ordena todo el módulo: **el servicio genera
    la deuda, el pago genera el movimiento de caja**. Crear una venta no
    mueve plata ni necesita caja abierta; cobrarla sí.

    Quién puede qué:

    - **crear** — cualquier miembro activo. Sin `puede_cobrar`, solo puede
      facturar líneas de trabajo **propio** (ver `VentaSerializer`), para
      que nadie le cargue trabajo ni comisión a un compañero. Lo normal es
      que no haga falta: la venta la genera sola la cita al completarse.
    - **listar/ver** — sin `puede_cobrar` ni `puede_ver_reportes`, solo las
      ventas en las que uno participó. Una venta ajena responde 404, igual
      que una inexistente (`CONTRATO.md` 5.2).
    - **cobrar** — `puede_cobrar`.
    - **devolver / anular** — `puede_anular_venta`. Son las dos acciones
      que mueven dinero hacia atrás y por eso viven en una capacidad
      aparte de la de cobrar.

    Sin `PUT`/`PATCH`/`DELETE`: una venta equivocada se **anula** (y si ya
    tenía cobros, se devuelve), nunca se edita ni se borra. El historial
    financiero no se altera retroactivamente.
    """

    serializer_class = VentaSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [TieneMembresiaActiva()]
        if self.action in ("devolver", "anular"):
            return [requiere_capacidad("puede_anular_venta")()]
        return [requiere_capacidad("puede_cobrar")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Venta.objects.none()

        membresia = self.request.membresia
        ventas = (
            membresia.negocio.ventas.select_related("creada_por__usuario", "anulada_por__usuario")
            .prefetch_related(
                "items__empleado__usuario",
                "pagos__registrado_por__usuario",
                "devoluciones__registrado_por__usuario",
            )
        )
        if not (
            membresia.tiene("puede_cobrar") or membresia.tiene("puede_ver_reportes")
        ):
            # Las ventas traen nombre y teléfono del cliente: son la
            # libreta del negocio. Mismo criterio que la agenda propia en
            # `CitaViewSet.get_queryset`.
            ventas = ventas.filter(items__empleado=membresia).distinct()

        params = self.request.query_params
        estado = params.get("estado")
        if estado:
            ventas = ventas.filter(estado=estado)
        fecha_desde = params.get("fecha_desde")
        if fecha_desde:
            ventas = ventas.filter(creado_en__date__gte=fecha_desde)
        fecha_hasta = params.get("fecha_hasta")
        if fecha_hasta:
            ventas = ventas.filter(creado_en__date__lte=fecha_hasta)
        empleado_id = params.get("empleado")
        if empleado_id:
            ventas = ventas.filter(items__empleado_id=empleado_id).distinct()
        return ventas

    def _releer(self, venta):
        """Devuelve la venta recién salida de la base, no la del request.

        `refresh_from_db()` no alcanza: la instancia viene de `get_object()`
        con `prefetch_related`, y ese caché de pagos y devoluciones sobrevive
        al refresh — la respuesta mostraría la venta sin el pago que se acaba
        de registrar.
        """
        return self.get_queryset().get(pk=venta.pk)

    def perform_create(self, serializer):
        datos = serializer.validated_data
        try:
            venta = services.crear_venta(
                negocio=self.request.membresia.negocio,
                creada_por=self.request.membresia,
                nombre_cliente=datos["nombre_cliente"],
                telefono_cliente=datos.get("telefono_cliente", ""),
                observaciones=datos.get("observaciones", ""),
                evidencia=datos.get("evidencia"),
                items=datos["items"],
            )
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        serializer.instance = venta

    @extend_schema(
        request=CobrarSerializer,
        responses={200: VentaSerializer},
        description=(
            "Cobra la venta, total o parcialmente. Crea el pago **y** su "
            "movimiento de caja en la misma transacción, así que exige caja "
            "abierta.\n\n"
            "Un pago mixto son dos llamadas a este endpoint sobre la misma "
            "venta, una por método. Cuando lo cobrado alcanza el total, la "
            "venta pasa a `pagada` y recién ahí se devengan las comisiones."
        ),
    )
    @action(detail=True, methods=["post"])
    def cobrar(self, request, pk=None):
        venta = self.get_object()
        entrada = CobrarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            services.registrar_pago(
                venta=venta,
                registrado_por=request.membresia,
                monto=entrada.validated_data["monto"],
                metodo_pago=entrada.validated_data["metodo_pago"],
            )
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        return Response(VentaSerializer(self._releer(venta), context={"request": request}).data)

    @extend_schema(
        request=DevolverSerializer,
        responses={200: VentaSerializer},
        description=(
            "Devuelve plata al cliente. **No edita ni borra** el cobro "
            "original: genera un movimiento nuevo de tipo `devolucion`, de "
            "modo que las dos mitades del hecho quedan en el libro."
        ),
    )
    @action(detail=True, methods=["post"])
    def devolver(self, request, pk=None):
        venta = self.get_object()
        entrada = DevolverSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            services.devolver(
                venta=venta, registrado_por=request.membresia, **entrada.validated_data
            )
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        return Response(VentaSerializer(self._releer(venta), context={"request": request}).data)

    @extend_schema(
        request=AnularVentaSerializer,
        responses={200: VentaSerializer},
        description=(
            "Anula la venta. Si ya tenía cobros, genera la devolución por lo "
            "cobrado (y por lo tanto exige caja abierta). Revierte las "
            "comisiones devengadas. Es terminal: una venta anulada no se "
            "vuelve a cobrar."
        ),
    )
    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        venta = self.get_object()
        entrada = AnularVentaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            venta = services.anular_venta(
                venta=venta,
                responsable=request.membresia,
                motivo=entrada.validated_data["motivo"],
                metodo_devolucion=entrada.validated_data.get("metodo_devolucion"),
            )
        except ERRORES_DE_NEGOCIO as error:
            raise _traducir(error)
        return Response(VentaSerializer(venta, context={"request": request}).data)
