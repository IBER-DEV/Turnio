from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.caja.models import (
    PESO_MAXIMO_EVIDENCIA_BYTES,
    Caja,
    Devolucion,
    MetodoPago,
    MovimientoCaja,
    Pago,
    Venta,
    VentaItem,
)
from apps.servicios.models import Servicio
from apps.usuarios.models import MiembroNegocio


def validar_peso_evidencia(imagen):
    """Mismo criterio que `apps.negocios.serializers.validar_peso_imagen`:
    se duplica en vez de importar entre apps de dominio distinto por una
    validación de 6 líneas."""
    if imagen.size > PESO_MAXIMO_EVIDENCIA_BYTES:
        megas = PESO_MAXIMO_EVIDENCIA_BYTES / (1024 * 1024)
        raise serializers.ValidationError(
            f"La imagen pesa demasiado. El máximo son {megas:.0f} MB."
        )
    return imagen


# --------------------------------------------------------------------------
# Movimientos
# --------------------------------------------------------------------------


class MovimientoCajaSerializer(serializers.ModelSerializer):
    """Una línea del libro. **Solo lectura**: los movimientos no se crean
    sueltos ni se editan.

    Un ingreso nace de cobrar una venta (`POST /api/caja/ventas/{id}/cobrar/`),
    una devolución de devolver (`.../devolver/`), y un egreso tiene su
    propio endpoint (`POST /api/caja/egresos/`). No hay un "crear
    movimiento" genérico a propósito: era la puerta por la que entraba
    plata que ninguna venta explicaba.
    """

    registrado_por_nombre = serializers.CharField(
        source="registrado_por.usuario.nombre", read_only=True
    )

    class Meta:
        model = MovimientoCaja
        fields = [
            "id",
            "caja",
            "tipo",
            "metodo_pago",
            "monto",
            "concepto",
            "categoria",
            "venta",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]
        read_only_fields = fields


class EgresoSerializer(serializers.Serializer):
    """Entrada de `POST /api/caja/egresos/`."""

    monto = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )
    concepto = serializers.CharField(max_length=200)
    categoria = serializers.ChoiceField(choices=MovimientoCaja.CategoriaEgreso.choices)
    metodo_pago = serializers.ChoiceField(
        choices=MetodoPago.choices,
        default=MetodoPago.EFECTIVO,
        help_text=(
            "Con qué se pagó. Solo `efectivo` afecta el arqueo del cajón; "
            "el resto se concilia contra el extracto de su plataforma."
        ),
    )


# --------------------------------------------------------------------------
# Ventas
# --------------------------------------------------------------------------


class VentaItemSerializer(serializers.ModelSerializer):
    """Una línea de la venta.

    Al **crear**, se manda `servicio` (y de ahí se copian descripción,
    precio y comisión) o bien `descripcion` + `precio_unitario` a mano,
    para vender algo que todavía no tiene catálogo. `empleado` es siempre
    obligatorio: es la fuente de verdad de la comisión.

    Al **leer**, `descripcion`, `precio_unitario` y `porcentaje_comision`
    son los valores congelados al momento de la venta, no los del
    catálogo de hoy.
    """

    empleado_nombre = serializers.CharField(source="empleado.usuario.nombre", read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    servicio = serializers.PrimaryKeyRelatedField(
        queryset=Servicio.objects.all(), required=False, allow_null=True
    )
    empleado = serializers.PrimaryKeyRelatedField(queryset=MiembroNegocio.objects.all())
    descripcion = serializers.CharField(max_length=200, required=False)
    precio_unitario = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, min_value=Decimal("0.01")
    )

    class Meta:
        model = VentaItem
        fields = [
            "id",
            "servicio",
            "empleado",
            "empleado_nombre",
            "descripcion",
            "precio_unitario",
            "cantidad",
            "porcentaje_comision",
            "subtotal",
        ]
        read_only_fields = ["id", "empleado_nombre", "subtotal", "porcentaje_comision"]

    def _negocio_id(self):
        return self.context["request"].membresia.negocio_id

    def validate_servicio(self, servicio):
        if servicio is None:
            return servicio
        if servicio.negocio_id != self._negocio_id():
            raise serializers.ValidationError("Ese servicio no pertenece a tu negocio.")
        if not servicio.activo:
            raise serializers.ValidationError("Ese servicio ya no está activo.")
        return servicio

    def validate_empleado(self, empleado):
        if empleado.negocio_id != self._negocio_id():
            raise serializers.ValidationError("Ese empleado no pertenece a tu negocio.")
        if not empleado.activo:
            raise serializers.ValidationError("Ese empleado no está activo.")
        return empleado

    def validate(self, datos):
        if not datos.get("servicio") and not (
            datos.get("descripcion") and datos.get("precio_unitario")
        ):
            raise serializers.ValidationError(
                "Cada línea necesita un `servicio`, o bien `descripcion` y "
                "`precio_unitario` para algo que no está en el catálogo."
            )
        return datos


class PagoSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.CharField(
        source="registrado_por.usuario.nombre", read_only=True
    )

    class Meta:
        model = Pago
        fields = [
            "id",
            "monto",
            "metodo_pago",
            "registrado_por",
            "registrado_por_nombre",
            "movimiento",
            "creado_en",
        ]
        read_only_fields = fields


class DevolucionSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.CharField(
        source="registrado_por.usuario.nombre", read_only=True
    )

    class Meta:
        model = Devolucion
        fields = [
            "id",
            "monto",
            "metodo_pago",
            "motivo",
            "registrado_por",
            "registrado_por_nombre",
            "movimiento",
            "creado_en",
        ]
        read_only_fields = fields


class VentaSerializer(serializers.ModelSerializer):
    """Una cuenta: qué se hizo, cuánto vale, cuánto se cobró.

    `estado`, `total` y todo lo relacionado con el cobro son de solo
    lectura: los fija el servidor a través de `cobrar`, `devolver` y
    `anular`. El cliente solo manda el cliente, los items y (si aplica)
    la evidencia.
    """

    items = VentaItemSerializer(many=True)
    pagos = PagoSerializer(many=True, read_only=True)
    devoluciones = DevolucionSerializer(many=True, read_only=True)
    total_pagado = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    saldo_pendiente = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    creada_por_nombre = serializers.CharField(
        source="creada_por.usuario.nombre", read_only=True
    )
    evidencia = serializers.ImageField(
        required=False, allow_null=True, validators=[validar_peso_evidencia]
    )

    class Meta:
        model = Venta
        fields = [
            "id",
            "cita",
            "nombre_cliente",
            "telefono_cliente",
            "items",
            "total",
            "total_pagado",
            "saldo_pendiente",
            "estado",
            "observaciones",
            "evidencia",
            "pagos",
            "devoluciones",
            "creada_por",
            "creada_por_nombre",
            "anulada_por",
            "anulada_en",
            "motivo_anulacion",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "cita",
            "total",
            "total_pagado",
            "saldo_pendiente",
            "estado",
            "pagos",
            "devoluciones",
            "creada_por",
            "creada_por_nombre",
            "anulada_por",
            "anulada_en",
            "motivo_anulacion",
            "creado_en",
        ]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Una venta necesita al menos una línea.")

        # Sin `puede_cobrar`, uno solo puede facturar **su propio**
        # trabajo. Es la misma regla que protegía al viejo registro de
        # servicios: sin esto, cualquiera con acceso a la cuenta podía
        # cargarle trabajo (y comisión) a un compañero, o inventarse el
        # propio a nombre de otro.
        solicitante = self.context["request"].membresia
        if not solicitante.tiene("puede_cobrar"):
            ajenos = [item for item in items if item["empleado"].pk != solicitante.pk]
            if ajenos:
                raise serializers.ValidationError(
                    "Solo puedes registrar servicios realizados por ti."
                )
        return items


class CobrarSerializer(serializers.Serializer):
    """Entrada de `POST /api/caja/ventas/{id}/cobrar/`.

    Un pago mixto son **dos llamadas** a este endpoint sobre la misma
    venta, una por método. Se prefirió eso a recibir una lista de pagos
    en un solo request porque cada pago es un hecho independiente que
    puede fallar por su cuenta (la caja se cerró entremedio, el monto
    excede el saldo), y un error parcial dentro de una lista es
    justamente lo que no se quiere en el dominio de dinero.
    """

    monto = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )
    metodo_pago = serializers.ChoiceField(choices=MetodoPago.choices)


class DevolverSerializer(serializers.Serializer):
    monto = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )
    metodo_pago = serializers.ChoiceField(choices=MetodoPago.choices)
    motivo = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)


class AnularVentaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)
    metodo_devolucion = serializers.ChoiceField(
        choices=MetodoPago.choices,
        required=False,
        help_text=(
            "Con qué se le devuelve la plata al cliente, si la venta ya tenía "
            "cobros. Por defecto, el método del primer pago."
        ),
    )


# --------------------------------------------------------------------------
# Caja
# --------------------------------------------------------------------------


class CajaListaSerializer(serializers.ModelSerializer):
    """Una caja en el histórico — sin movimientos ni resumen, para que
    listar varias no cargue todo su detalle."""

    abierta_por_nombre = serializers.CharField(source="abierta_por.usuario.nombre", read_only=True)
    cerrada_por_nombre = serializers.CharField(
        source="cerrada_por.usuario.nombre", read_only=True, default=None, allow_null=True
    )

    class Meta:
        model = Caja
        fields = [
            "id",
            "estado",
            "saldo_inicial",
            "abierta_por",
            "abierta_por_nombre",
            "abierta_en",
            "cerrada_por",
            "cerrada_por_nombre",
            "cerrada_en",
            "nota_cierre",
            "efectivo_esperado",
            "efectivo_contado",
            "diferencia",
        ]
        read_only_fields = fields


class ResumenComisionSerializer(serializers.Serializer):
    empleado = serializers.IntegerField()
    empleado_nombre = serializers.CharField()
    monto = serializers.DecimalField(max_digits=10, decimal_places=2)


class ResumenCajaSerializer(serializers.Serializer):
    """Los totales de una caja, siempre calculados en caliente
    (`apps.caja.services.resumen_de`) — nunca persistidos."""

    total_ingresos = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_egresos = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_devoluciones = serializers.DecimalField(max_digits=10, decimal_places=2)
    neto = serializers.DecimalField(max_digits=10, decimal_places=2)
    por_metodo_pago = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2)
    )
    egresos_por_categoria = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2)
    )
    comisiones_por_empleado = ResumenComisionSerializer(many=True)
    ventas_sin_cobrar = serializers.IntegerField(
        help_text=(
            "Cuántas ventas del negocio siguen pendientes o parciales. "
            "Informativo, no bloquea el cierre."
        )
    )

    # Arqueo: solo efectivo. Ver `apps.caja.services.arqueo_de`.
    saldo_inicial = serializers.DecimalField(max_digits=10, decimal_places=2)
    ingresos_efectivo = serializers.DecimalField(max_digits=10, decimal_places=2)
    egresos_efectivo = serializers.DecimalField(max_digits=10, decimal_places=2)
    devoluciones_efectivo = serializers.DecimalField(max_digits=10, decimal_places=2)
    efectivo_esperado = serializers.DecimalField(max_digits=10, decimal_places=2)


class CajaDetalleSerializer(CajaListaSerializer):
    """El detalle de una caja: sus movimientos y el resumen agregado."""

    movimientos = MovimientoCajaSerializer(many=True, read_only=True)
    resumen = serializers.SerializerMethodField()

    class Meta(CajaListaSerializer.Meta):
        fields = CajaListaSerializer.Meta.fields + ["movimientos", "resumen"]
        read_only_fields = fields

    # Sin `@extend_schema_field`, drf-spectacular no puede inferir qué
    # devuelve un `SerializerMethodField` y cae a `type: string` — mismo
    # bug de patrón que ya pasó con `NegocioPublicoSerializer` (ver
    # ROADMAP-BACKEND.md): el schema queda sintácticamente válido y
    # semánticamente falso, y el frontend no puede tipar el resumen.
    @extend_schema_field(ResumenCajaSerializer)
    def get_resumen(self, caja):
        from apps.caja.services import resumen_de

        return ResumenCajaSerializer(resumen_de(caja)).data


class AbrirCajaSerializer(serializers.Serializer):
    saldo_inicial = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        min_value=Decimal("0"),
        default=Decimal("0"),
    )


class CerrarCajaSerializer(serializers.Serializer):
    """Entrada del cierre. `efectivo_contado` es **obligatorio**: cerrar
    sin contar el cajón es lo que hacía que el módulo no sirviera para
    detectar un faltante."""

    efectivo_contado = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0"),
        help_text="Lo que se contó de verdad en el cajón, en efectivo.",
    )
    nota_cierre = serializers.CharField(required=False, allow_blank=True, default="")
