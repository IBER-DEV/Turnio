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


class ServicioLoteSerializer(serializers.Serializer):
    """Entrada de `POST /api/servicios/lote/`.

    Se creó como endpoint aparte en vez de aceptar una lista en el `POST`
    normal para no volver ambiguo el body de creación de a uno: el
    schema OpenAPI quedaría con un `oneOf` que el frontend tendría que
    desambiguar en cada llamada.
    """

    servicios = ServicioSerializer(many=True, allow_empty=False)
