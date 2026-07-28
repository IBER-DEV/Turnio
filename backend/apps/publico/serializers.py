"""Formas de lo que ve alguien **sin sesión**.

Estos serializers son la frontera del negocio hacia internet. La regla que
los gobierna es negativa: no reusar los serializers internos, aunque el
modelo sea el mismo. Un `ServicioSerializer` interno expone
`porcentaje_comision`; un `MiembroEquipoSerializer` expone `activo`. Nada
de eso le importa a un cliente y todo eso es información del negocio.

Por eso acá cada campo está escrito a mano: si alguien agrega un campo a
un modelo, no aparece solo en la web pública.
"""

from rest_framework import serializers

from apps.agenda.models import HorarioNegocio
from apps.negocios.models import Negocio
from apps.servicios.models import Servicio
from apps.usuarios.models import MiembroNegocio


class NegocioPublicoResumenSerializer(serializers.ModelSerializer):
    """Un negocio en la lista de resultados de búsqueda."""

    class Meta:
        model = Negocio
        fields = ["slug", "nombre", "ciudad"]
        read_only_fields = fields


class ServicioPublicoSerializer(serializers.ModelSerializer):
    """Un servicio como lo ve el cliente: qué es, cuánto cuesta, cuánto dura.

    Sin `porcentaje_comision`, que es un acuerdo interno entre el negocio y
    su gente.
    """

    class Meta:
        model = Servicio
        fields = ["id", "nombre", "descripcion", "categoria", "precio", "duracion_minutos"]
        read_only_fields = fields


class ProfesionalPublicoSerializer(serializers.ModelSerializer):
    """Quién atiende, como se le presenta al cliente.

    Acá es donde `especialidad` gana su razón de ser: es lo que le dice al
    cliente "este hace fades" cuando elige con quién. Sin email, sin cargo
    y sin capacidades — eso es organización interna del negocio.
    """

    nombre = serializers.CharField(source="usuario.nombre", read_only=True)

    class Meta:
        model = MiembroNegocio
        fields = ["id", "nombre", "especialidad"]
        read_only_fields = fields


class HorarioNegocioPublicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HorarioNegocio
        fields = ["dia_semana", "hora_inicio", "hora_fin"]
        read_only_fields = fields


class NegocioPublicoSerializer(serializers.ModelSerializer):
    """El perfil público completo de un negocio."""

    servicios = serializers.SerializerMethodField()
    profesionales = serializers.SerializerMethodField()
    horario = serializers.SerializerMethodField()

    class Meta:
        model = Negocio
        fields = [
            "slug",
            "nombre",
            "ciudad",
            "direccion",
            "telefono",
            "servicios",
            "profesionales",
            "horario",
        ]
        read_only_fields = fields

    def get_servicios(self, negocio):
        activos = [servicio for servicio in negocio.servicios.all() if servicio.activo]
        return ServicioPublicoSerializer(activos, many=True).data

    def get_profesionales(self, negocio):
        activos = [miembro for miembro in negocio.miembros.all() if miembro.activo]
        return ProfesionalPublicoSerializer(activos, many=True).data

    def get_horario(self, negocio):
        return HorarioNegocioPublicoSerializer(negocio.horarios.all(), many=True).data


class DisponibilidadConsultaSerializer(serializers.Serializer):
    """Los parámetros de `GET .../disponibilidad/`."""

    servicio = serializers.IntegerField()
    fecha = serializers.DateField()


class HuecoSerializer(serializers.Serializer):
    """Una hora a la que se puede reservar.

    Solo la hora: con quién lo resuelve el backend al confirmar. Decir de
    antemano qué empleado la tomaría sería una promesa que otra reserva
    simultánea puede romper entre que se muestra y se confirma.
    """

    inicio = serializers.DateTimeField()


class ReservaSerializer(serializers.Serializer):
    """Lo que manda un cliente para reservar. Sin cuenta: nombre y teléfono.

    `empleado` es opcional — si el cliente eligió a alguien, se respeta; si
    no, se le asigna quien esté libre.
    """

    servicio = serializers.IntegerField()
    fecha_hora_inicio = serializers.DateTimeField()
    nombre_cliente = serializers.CharField(max_length=150)
    telefono_cliente = serializers.CharField(max_length=30)
    empleado = serializers.IntegerField(required=False, allow_null=True, default=None)
    notas = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)


class ReservaConfirmadaSerializer(serializers.Serializer):
    """Lo que se le devuelve al cliente tras reservar.

    Deliberadamente magro: confirma lo suyo y nada del negocio. No lleva el
    `id` de la cita porque hoy no hay nada que el cliente pueda hacer con
    él —cancelar sin cuenta requeriría un token de acceso, que es una
    decisión aparte— y un id expuesto sin uso solo invita a probar otros.
    """

    negocio = serializers.CharField()
    servicio = serializers.CharField()
    profesional = serializers.CharField()
    fecha_hora_inicio = serializers.DateTimeField()
    fecha_hora_fin = serializers.DateTimeField()
    nombre_cliente = serializers.CharField()
