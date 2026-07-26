from rest_framework import serializers

from apps.agenda.models import Cita, DiaSemana, HorarioNegocio, HorarioTrabajo
from apps.servicios.models import Servicio
from apps.usuarios.models import MiembroNegocio


class HorarioTrabajoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HorarioTrabajo
        fields = ["id", "miembro", "dia_semana", "hora_inicio", "hora_fin"]

    def validate(self, datos):
        if datos["hora_inicio"] >= datos["hora_fin"]:
            raise serializers.ValidationError("hora_inicio debe ser anterior a hora_fin.")
        return datos

    def validate_miembro(self, miembro):
        request = self.context["request"]
        if miembro.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese empleado no pertenece a tu negocio.")
        return miembro


class FranjaHorarioSerializer(serializers.Serializer):
    """Una franja suelta dentro de la semana. Sin `miembro`: lo define el
    contenedor, para no repetirlo en cada elemento de la lista."""

    dia_semana = serializers.ChoiceField(choices=DiaSemana.choices)
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()


class HorarioSemanalSerializer(serializers.Serializer):
    """Entrada de `PUT /api/agenda/horarios/semana/`.

    `miembros` es una lista porque lo normal es que todo el equipo comparta
    el mismo horario; un solo empleado es el caso n=1, no una forma aparte.
    Va vacía nunca: sin destinatarios no hay nada que aplicar.

    Semántica de reemplazo: la lista de franjas es el horario completo de
    **cada** empleado señalado, no un agregado. Mandar `franjas: []` los
    deja sin disponibilidad.
    """

    miembros = serializers.PrimaryKeyRelatedField(
        queryset=MiembroNegocio.objects.all(), many=True, allow_empty=False
    )
    franjas = FranjaHorarioSerializer(many=True, allow_empty=True)

    def validate_miembros(self, miembros):
        request = self.context["request"]
        ajenos = [
            miembro
            for miembro in miembros
            if miembro.negocio_id != request.membresia.negocio_id
        ]
        if ajenos:
            # Sin decir cuál ni cuántos: quien pregunta por un id ajeno no
            # debe poder deducir nada sobre él (ver CONTRATO.md 5.5).
            raise serializers.ValidationError("Alguno de esos empleados no pertenece a tu negocio.")
        return miembros


class HorarioNegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = HorarioNegocio
        fields = ["id", "dia_semana", "hora_inicio", "hora_fin"]


class HorarioNegocioSemanalSerializer(serializers.Serializer):
    """Entrada de `PUT /api/agenda/horario-negocio/`.

    Solo `franjas`: el negocio sale del token, nunca del body (ver
    CONTRATO.md sección 5.5). Semántica de reemplazo, igual que el horario
    por empleado.
    """

    franjas = FranjaHorarioSerializer(many=True, allow_empty=True)


class CitaSerializer(serializers.ModelSerializer):
    servicio_nombre = serializers.CharField(source="servicio.nombre", read_only=True)
    empleado_nombre = serializers.CharField(source="empleado.usuario.nombre", read_only=True)

    class Meta:
        model = Cita
        fields = [
            "id",
            "servicio",
            "servicio_nombre",
            "empleado",
            "empleado_nombre",
            "fecha_hora_inicio",
            "fecha_hora_fin",
            "estado",
            "nombre_cliente",
            "telefono_cliente",
            "notas",
        ]
        read_only_fields = ["id", "fecha_hora_fin", "estado", "servicio_nombre", "empleado_nombre"]


class CitaCreateSerializer(serializers.Serializer):
    """Entrada para agendar una cita. `empleado` es opcional: si se
    omite, se asigna automáticamente el primer empleado disponible."""

    servicio = serializers.PrimaryKeyRelatedField(queryset=Servicio.objects.all())
    empleado = serializers.PrimaryKeyRelatedField(
        queryset=MiembroNegocio.objects.all(), required=False, allow_null=True, default=None
    )
    fecha_hora_inicio = serializers.DateTimeField()
    nombre_cliente = serializers.CharField(max_length=150)
    telefono_cliente = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    notas = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_servicio(self, servicio):
        request = self.context["request"]
        if servicio.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese servicio no pertenece a tu negocio.")
        return servicio

    def validate_empleado(self, empleado):
        if empleado is None:
            return empleado
        request = self.context["request"]
        if empleado.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese empleado no pertenece a tu negocio.")
        return empleado
