from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.negocios.models import Negocio
from apps.negocios.services import (
    CAMPOS_CAPACIDADES,
    CambioDeCapacidadNoPermitido,
    validar_cambio_de_capacidades,
)
from apps.usuarios.models import MiembroNegocio, Usuario


def _solicitante(contexto):
    """La membresía de quien hace el request, si la hay.

    En el registro de un negocio no hay ninguna: el dueño se está creando
    en ese mismo request y recibe todas las capacidades por definición.
    """
    request = contexto.get("request")
    return getattr(request, "membresia", None) if request is not None else None


class EmpleadoAltaSerializer(serializers.Serializer):
    """Empleado adicional dado de alta junto con el registro del negocio."""

    email = serializers.EmailField()
    nombre = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    especialidad = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    puede_cobrar = serializers.BooleanField(default=False)
    puede_ver_reportes = serializers.BooleanField(default=False)
    puede_editar_precios = serializers.BooleanField(default=False)
    puede_gestionar_empleados = serializers.BooleanField(default=False)
    puede_gestionar_agenda = serializers.BooleanField(default=False)
    puede_configurar_horarios = serializers.BooleanField(default=False)
    puede_ver_agenda_completa = serializers.BooleanField(default=False)

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def validate(self, datos):
        solicitante = _solicitante(self.context)
        if solicitante is None:
            return datos

        try:
            validar_cambio_de_capacidades(
                solicitante=solicitante,
                capacidades_pedidas={
                    campo: datos.get(campo, False) for campo in CAMPOS_CAPACIDADES
                },
            )
        except CambioDeCapacidadNoPermitido as error:
            raise serializers.ValidationError({"non_field_errors": [str(error)]})
        return datos


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
            "especialidad",
            "puede_cobrar",
            "puede_ver_reportes",
            "puede_editar_precios",
            "puede_gestionar_empleados",
            "puede_gestionar_agenda",
            "puede_configurar_horarios",
            "puede_ver_agenda_completa",
            "activo",
        ]
        read_only_fields = ["id", "email", "nombre"]

    def validate(self, datos):
        solicitante = _solicitante(self.context)
        if solicitante is None or self.instance is None:
            return datos

        # Solo los cambios reales: reenviar una capacidad con el valor que
        # ya tenía no es un cambio y no debe rebotar.
        pedidas = {
            campo: datos[campo]
            for campo in CAMPOS_CAPACIDADES
            if campo in datos and datos[campo] != getattr(self.instance, campo)
        }
        try:
            validar_cambio_de_capacidades(
                solicitante=solicitante, objetivo=self.instance, capacidades_pedidas=pedidas
            )
        except CambioDeCapacidadNoPermitido as error:
            raise serializers.ValidationError({"non_field_errors": [str(error)]})
        return datos


class MiembroEquipoSerializer(serializers.ModelSerializer):
    """Vista mínima de un compañero de trabajo, para quien NO gestiona
    el equipo.

    Existe porque la agenda necesita listar empleados (filtrar el
    calendario, elegir a quién asignar una cita, cargar horarios), pero
    eso no justifica exponerle a cualquier miembro el email y la matriz
    de capacidades de todos sus compañeros — que es lo que hacía
    `MiembroNegocioSerializer` cuando se usaba para listar sin exigir
    `puede_gestionar_empleados`.

    Deliberadamente sin `email` ni flags `puede_*`.
    """

    nombre = serializers.CharField(source="usuario.nombre", read_only=True)

    class Meta:
        model = MiembroNegocio
        fields = ["id", "nombre", "especialidad", "activo"]
        read_only_fields = fields


class MiMembresiaSerializer(serializers.ModelSerializer):
    """Forma de la respuesta de GET /api/negocios/mi-membresia/.

    Pensado para que el frontend, justo después de loguearse, resuelva
    en un solo request "quién soy, en qué negocio y qué puedo hacer"
    sin tener que listar empleados y buscarse a sí mismo por email.
    """

    email = serializers.EmailField(source="usuario.email", read_only=True)
    nombre = serializers.CharField(source="usuario.nombre", read_only=True)
    negocio = NegocioSerializer(read_only=True)

    class Meta:
        model = MiembroNegocio
        fields = [
            "id",
            "email",
            "nombre",
            "especialidad",
            "negocio",
            "puede_cobrar",
            "puede_ver_reportes",
            "puede_editar_precios",
            "puede_gestionar_empleados",
            "puede_gestionar_agenda",
            "puede_configurar_horarios",
            "puede_ver_agenda_completa",
            "activo",
        ]
        read_only_fields = fields
