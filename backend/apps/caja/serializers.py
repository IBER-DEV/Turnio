from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.caja.models import Caja, MovimientoCaja


class MovimientoCajaSerializer(serializers.ModelSerializer):
    """Un ingreso o egreso. Alta y consulta — no hay edición (ver el
    modelo: es un libro contable, inmutable tras crearse)."""

    registrado_por_nombre = serializers.CharField(
        source="registrado_por.usuario.nombre", read_only=True
    )
    empleado_comision_nombre = serializers.CharField(
        source="empleado_comision.usuario.nombre", read_only=True, default=None, allow_null=True
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
            "registro_servicio",
            "empleado_comision",
            "empleado_comision_nombre",
            "monto_comision",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "caja",
            "empleado_comision_nombre",
            "monto_comision",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]

    def validate_registro_servicio(self, registro):
        request = self.context["request"]
        if registro.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese registro de servicio no pertenece a tu negocio.")
        return registro

    def validate_empleado_comision(self, empleado):
        # Libre solo cuando no hay `registro_servicio` (ej. anotar a quién
        # corresponde una venta suelta): con vínculo, el servicio de
        # aplicación lo sobreescribe siempre con `registro_servicio.empleado`
        # y este valor se ignora — no hace falta rechazarlo acá, alcanza
        # con que no pueda ser de otro negocio.
        request = self.context["request"]
        if empleado.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese empleado no pertenece a tu negocio.")
        return empleado

    def validate(self, datos):
        tipo = datos.get("tipo")
        if tipo == MovimientoCaja.Tipo.INGRESO and not datos.get("metodo_pago"):
            raise serializers.ValidationError(
                {"metodo_pago": ["Un ingreso necesita el método de pago."]}
            )
        if tipo == MovimientoCaja.Tipo.EGRESO:
            if datos.get("metodo_pago"):
                raise serializers.ValidationError(
                    {"metodo_pago": ["Un egreso no lleva método de pago."]}
                )
            if datos.get("registro_servicio"):
                raise serializers.ValidationError(
                    {"registro_servicio": ["Un egreso no puede vincularse a un servicio cobrado."]}
                )
        return datos


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
    neto = serializers.DecimalField(max_digits=10, decimal_places=2)
    por_metodo_pago = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2)
    )
    comisiones_por_empleado = ResumenComisionSerializer(many=True)
    servicios_aprobados_sin_cobrar = serializers.IntegerField(
        help_text=(
            "Cuántos RegistroServicio aprobados durante esta caja no tienen "
            "ningún movimiento vinculado. Informativo, no bloquea el cierre."
        )
    )


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
    nota_cierre = serializers.CharField(required=False, allow_blank=True, default="")
