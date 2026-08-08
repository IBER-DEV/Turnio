from decimal import Decimal

from rest_framework import serializers

from apps.servicios.models import Servicio


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
