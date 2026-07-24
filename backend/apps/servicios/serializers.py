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
