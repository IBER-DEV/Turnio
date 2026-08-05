from decimal import Decimal

from rest_framework import serializers

from apps.servicios.models import PESO_MAXIMO_EVIDENCIA_BYTES, RegistroServicio, Servicio
from apps.usuarios.models import MiembroNegocio


class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = [
            "id",
            "nombre",
            "descripcion",
            "categoria",
            "precio",
            "duracion_minutos",
            "porcentaje_comision",
            "activo",
        ]

    def validate_precio(self, value):
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a cero.")
        return value

    def validate_duracion_minutos(self, value):
        if value <= 0:
            raise serializers.ValidationError("La duración debe ser mayor a cero.")
        return value

    def validate(self, datos):
        # Gating por campo: `precio` y `porcentaje_comision` son dos
        # dominios de confianza distintos (ver `Cargo.puede_editar_comisiones`)
        # aunque compartan el mismo endpoint. Se compara contra el valor
        # actual (o el default de creación) y solo exige la capacidad si
        # el valor **cambia** — reenviar lo que ya tenía no es un intento
        # de tocarlo, mismo criterio que `CargoSerializer.validate()` en
        # `apps.negocios.serializers`. `request` llega también cuando este
        # serializer se anida dentro de `ServicioLoteSerializer` (DRF
        # propaga el contexto del serializer raíz); el chequeo de `None`
        # es solo defensivo, para no romper si algún test lo instancia sin
        # contexto.
        request = self.context.get("request")
        if request is None or not hasattr(request, "membresia"):
            return datos

        solicitante = request.membresia
        bloqueados = {}

        if "precio" in datos:
            anterior = None if self.instance is None else self.instance.precio
            if datos["precio"] != anterior and not solicitante.tiene("puede_editar_precios"):
                bloqueados["precio"] = ["No tienes permiso para cambiar el precio."]

        if "porcentaje_comision" in datos:
            anterior = Decimal("0") if self.instance is None else self.instance.porcentaje_comision
            if datos["porcentaje_comision"] != anterior and not solicitante.tiene(
                "puede_editar_comisiones"
            ):
                bloqueados["porcentaje_comision"] = [
                    "No tienes permiso para cambiar la comisión."
                ]

        if bloqueados:
            raise serializers.ValidationError(bloqueados)
        return datos


class ServicioLoteSerializer(serializers.Serializer):
    """Entrada de `POST /api/servicios/lote/`.

    Se creó como endpoint aparte en vez de aceptar una lista en el `POST`
    normal para no volver ambiguo el body de creación de a uno: el
    schema OpenAPI quedaría con un `oneOf` que el frontend tendría que
    desambiguar en cada llamada.
    """

    servicios = ServicioSerializer(many=True, allow_empty=False)


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


class RegistroServicioSerializer(serializers.ModelSerializer):
    """Un registro de servicio realizado: alta y consulta.

    `estado`, `aprobado_por` y `fecha_revision` son de solo lectura
    porque los fija el servidor a través de las acciones
    `aprobar`/`rechazar`, nunca el cliente.

    `empleado` es un caso especial: **casi siempre** lo fija el servidor
    también (ver `RegistroServicioViewSet.perform_create`), pero quien
    tiene `puede_aprobar_servicios` puede —y debe— elegir a nombre de
    quién registra, para dejar constancia de un servicio que un barbero
    sin acceso a la app no pudo cargar él mismo. Por eso viaja como
    campo normal (no en `read_only_fields`) y su exigencia se resuelve en
    `validate()`, según quién hace el request.
    """

    empleado_nombre = serializers.CharField(source="empleado.usuario.nombre", read_only=True)
    servicio_nombre = serializers.CharField(source="servicio.nombre", read_only=True)
    aprobado_por_nombre = serializers.CharField(
        source="aprobado_por.usuario.nombre", read_only=True, default=None, allow_null=True
    )
    evidencia = serializers.ImageField(
        required=False, allow_null=True, validators=[validar_peso_evidencia]
    )
    empleado = serializers.PrimaryKeyRelatedField(
        queryset=MiembroNegocio.objects.all(),
        required=False,
        help_text=(
            "Quién realizó el servicio. Solo se puede elegir con "
            "`puede_aprobar_servicios`; sin esa capacidad, el campo se "
            "ignora y siempre queda el propio solicitante."
        ),
    )

    class Meta:
        model = RegistroServicio
        fields = [
            "id",
            "empleado",
            "empleado_nombre",
            "servicio",
            "servicio_nombre",
            "nombre_cliente",
            "telefono_cliente",
            "fecha_hora",
            "observaciones",
            "evidencia",
            "estado",
            "aprobado_por",
            "aprobado_por_nombre",
            "fecha_revision",
            "motivo_rechazo",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "estado",
            "aprobado_por",
            "fecha_revision",
            "motivo_rechazo",
            "creado_en",
        ]

    def validate_servicio(self, servicio):
        request = self.context["request"]
        if servicio.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese servicio no pertenece a tu negocio.")
        if not servicio.activo:
            raise serializers.ValidationError("Ese servicio ya no está activo.")
        return servicio

    def validate_empleado(self, empleado):
        request = self.context["request"]
        if empleado.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese empleado no pertenece a tu negocio.")
        if not empleado.activo:
            raise serializers.ValidationError("Ese empleado no está activo.")
        return empleado

    def validate(self, datos):
        # Solo importa al crear: `empleado` no es editable después (no
        # hay PUT/PATCH en este ViewSet), así que en una revisión (que no
        # pasa por acá, son acciones aparte) esto no aplica.
        if self.instance is None and self.context["request"].membresia.tiene(
            "puede_aprobar_servicios"
        ):
            if "empleado" not in datos:
                raise serializers.ValidationError(
                    {"empleado": ["Selecciona quién realizó el servicio."]}
                )
        return datos


class RechazoSerializer(serializers.Serializer):
    """Entrada de `POST .../registros/{id}/rechazar/`: el motivo es
    obligatorio — es lo que el empleado va a leer en su propio historial."""

    motivo = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)
