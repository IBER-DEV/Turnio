from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.negocios.models import Negocio
from apps.usuarios.models import MiembroNegocio, Usuario


class EmpleadoAltaSerializer(serializers.Serializer):
    """Empleado adicional dado de alta junto con el registro del negocio."""

    email = serializers.EmailField()
    nombre = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    puede_cobrar = serializers.BooleanField(default=False)
    puede_ver_reportes = serializers.BooleanField(default=False)
    puede_editar_precios = serializers.BooleanField(default=False)
    puede_gestionar_empleados = serializers.BooleanField(default=False)
    puede_gestionar_agenda = serializers.BooleanField(default=False)

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value


class RegistroNegocioSerializer(serializers.Serializer):
    nombre_negocio = serializers.CharField(max_length=150)
    ciudad = serializers.CharField(max_length=100, required=False, allow_blank=True)
    direccion = serializers.CharField(max_length=255, required=False, allow_blank=True)
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True)

    email_dueno = serializers.EmailField()
    nombre_dueno = serializers.CharField(max_length=150)
    password_dueno = serializers.CharField(write_only=True, validators=[validate_password])

    empleados = EmpleadoAltaSerializer(many=True, required=False, default=list)

    def validate_email_dueno(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def validate_empleados(self, value):
        emails = [empleado["email"].lower() for empleado in value]
        if len(emails) != len(set(emails)):
            raise serializers.ValidationError("Hay emails de empleados duplicados.")
        return value


class NegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Negocio
        fields = ["id", "nombre", "slug", "ciudad", "direccion", "telefono", "activo"]
        read_only_fields = fields


class RegistroNegocioRespuestaSerializer(serializers.Serializer):
    """Forma de la respuesta de POST /api/negocios/registro/."""

    negocio = NegocioSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


class MiembroNegocioSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="usuario.email", read_only=True)
    nombre = serializers.CharField(source="usuario.nombre", read_only=True)

    class Meta:
        model = MiembroNegocio
        fields = [
            "id",
            "email",
            "nombre",
            "puede_cobrar",
            "puede_ver_reportes",
            "puede_editar_precios",
            "puede_gestionar_empleados",
            "puede_gestionar_agenda",
            "activo",
        ]
        read_only_fields = ["id", "email", "nombre"]
