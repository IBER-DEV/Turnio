from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.negocios.models import (
    MAX_FOTOS_POR_NEGOCIO,
    PESO_MAXIMO_IMAGEN_BYTES,
    FotoNegocio,
    Negocio,
)
from apps.negocios.services import (
    CAMPOS_CAPACIDADES,
    CambioDeCapacidadNoPermitido,
    validar_asignacion_de_cargo,
    validar_cambio_de_capacidades,
)
from apps.usuarios.models import Cargo, MiembroNegocio, Usuario


def validar_peso_imagen(imagen):
    """Corta las imágenes demasiado pesadas antes de que toquen el disco.

    `ImageField` ya garantiza (vía Pillow) que el archivo sea una imagen
    de verdad y no un ejecutable renombrado; lo que no mira es el tamaño.
    Sin este límite, una foto de 40 MB directa de una cámara se serviría
    tal cual en el perfil público, que se abre por datos móviles.
    """
    if imagen.size > PESO_MAXIMO_IMAGEN_BYTES:
        megas = PESO_MAXIMO_IMAGEN_BYTES / (1024 * 1024)
        raise serializers.ValidationError(
            f"La imagen pesa demasiado. El máximo son {megas:.0f} MB."
        )
    return imagen


def _solicitante(contexto):
    """La membresía de quien hace el request, si la hay.

    En el registro de un negocio no hay ninguna: el dueño se está creando
    en ese mismo request y recibe el cargo de administración por
    definición.
    """
    request = contexto.get("request")
    return getattr(request, "membresia", None) if request is not None else None


class CargoSerializer(serializers.ModelSerializer):
    """Un cargo del negocio: nombre, tipo y qué concede.

    `miembros` sirve para que la UI avise antes de borrar y para explicar
    a cuánta gente afecta editarlo — que es la contrapartida de que el
    cargo sea la única fuente de verdad.
    """

    miembros = serializers.IntegerField(source="miembros.count", read_only=True)

    class Meta:
        model = Cargo
        fields = ["id", "nombre", "tipo", "miembros", *CAMPOS_CAPACIDADES]
        read_only_fields = ["id", "miembros"]

    def validate_nombre(self, nombre):
        request = self.context["request"]
        repetido = Cargo.objects.filter(
            negocio=request.membresia.negocio, nombre__iexact=nombre.strip()
        ).exclude(pk=self.instance.pk if self.instance else None)
        if repetido.exists():
            raise serializers.ValidationError("Ya tienes un cargo con ese nombre.")
        return nombre.strip()

    def validate(self, datos):
        solicitante = _solicitante(self.context)
        if solicitante is None:
            return datos

        # Solo los cambios reales: reenviar una capacidad con el valor que
        # ya tenía no es un intento de ampliarla.
        pedidas = {
            campo: datos[campo]
            for campo in CAMPOS_CAPACIDADES
            if campo in datos
            and (self.instance is None or datos[campo] != getattr(self.instance, campo))
        }
        try:
            validar_cambio_de_capacidades(
                solicitante=solicitante,
                capacidades_pedidas=pedidas,
                es_mi_cargo=self.instance is not None
                and solicitante.cargo_id == self.instance.pk,
            )
        except CambioDeCapacidadNoPermitido as error:
            raise serializers.ValidationError({"non_field_errors": [str(error)]})
        return datos


class EmpleadoAltaRegistroSerializer(serializers.Serializer):
    """Empleado dado de alta **dentro del registro del negocio**.

    Sin `cargo` a propósito: en ese request los cargos del negocio todavía
    no existen, así que un id solo podría apuntar a otro negocio. Estos
    empleados entran al cargo operativo sembrado y el dueño les cambia el
    cargo después, ya autenticado.
    """

    email = serializers.EmailField()
    nombre = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    especialidad = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value


class EmpleadoAltaSerializer(serializers.Serializer):
    """Empleado adicional: sus datos de acceso y en qué cargo entra."""

    email = serializers.EmailField()
    nombre = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    especialidad = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    cargo = serializers.PrimaryKeyRelatedField(
        queryset=Cargo.objects.all(), required=False, allow_null=True, default=None
    )

    def validate_email(self, value):
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este email.")
        return value

    def validate_cargo(self, cargo):
        solicitante = _solicitante(self.context)
        if cargo is None or solicitante is None:
            return cargo
        if cargo.negocio_id != solicitante.negocio_id:
            raise serializers.ValidationError("Ese cargo no pertenece a tu negocio.")
        return cargo

    def validate(self, datos):
        solicitante = _solicitante(self.context)
        if solicitante is None:
            return datos

        try:
            validar_asignacion_de_cargo(
                solicitante=solicitante, objetivo=None, cargo=datos.get("cargo")
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

    empleados = EmpleadoAltaRegistroSerializer(many=True, required=False, default=list)

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
        fields = [
            "id",
            "nombre",
            "slug",
            "ciudad",
            "direccion",
            "telefono",
            "logo",
            "activo",
        ]
        read_only_fields = fields
        # Un negocio sin logo devuelve `null`, no una cadena vacía. Sin
        # esto el schema lo declara `string` a secas y el frontend se
        # tipa contra una promesa que la API no cumple.
        extra_kwargs = {"logo": {"allow_null": True}}


class MiNegocioSerializer(serializers.ModelSerializer):
    """La ficha del negocio propio, para verla y editarla.

    Separado de `NegocioSerializer` (que es de solo lectura y viaja
    anidado en el registro y en `mi-membresia`) porque acá hay campos
    escribibles y validación de archivo.

    `slug` es **de solo lectura a propósito**: es la URL pública que el
    dueño ya repartió por WhatsApp y pegó en su bio de Instagram.
    Cambiarlo rompería todos esos enlaces en silencio y liberaría el slug
    viejo para que lo tome otro negocio. Si alguna vez hace falta
    cambiarlo, será un endpoint aparte con redirección del anterior, no un
    campo más de este formulario.
    """

    logo = serializers.ImageField(
        required=False, allow_null=True, validators=[validar_peso_imagen]
    )
    portada = serializers.ImageField(
        required=False, allow_null=True, validators=[validar_peso_imagen]
    )

    class Meta:
        model = Negocio
        fields = [
            "id",
            "nombre",
            "slug",
            "ciudad",
            "direccion",
            "telefono",
            "logo",
            "portada",
            "color_acento",
            "tema",
            "activo",
        ]
        read_only_fields = ["id", "slug", "activo"]
        extra_kwargs = {
            # Vacío es un valor válido y significa "el color de Turnio"
            # (ver `Negocio.color_acento`), así que el campo acepta la
            # cadena vacía además de un `#rrggbb`.
            "color_acento": {"allow_blank": True},
        }

    # Quitar una imagen se pide mandando el campo vacío (`null` en JSON, o
    # el campo vacío en multipart, que DRF traduce a `None`). El modelo
    # representa "sin imagen" con la cadena vacía, no con NULL —ver
    # `Negocio.logo`—, así que la traducción va acá y no en los servicios.
    def validate_logo(self, imagen):
        return "" if imagen is None else imagen

    def validate_portada(self, imagen):
        return "" if imagen is None else imagen


class FotoNegocioSerializer(serializers.ModelSerializer):
    """Una foto de la galería. `orden` no se escribe acá: lo fija
    `PUT .../fotos/orden/` sobre la lista completa."""

    imagen = serializers.ImageField(validators=[validar_peso_imagen])

    class Meta:
        model = FotoNegocio
        fields = ["id", "imagen", "orden"]
        read_only_fields = ["id", "orden"]


class OrdenFotosSerializer(serializers.Serializer):
    """El cuerpo de `PUT .../fotos/orden/`: la galería entera, en orden."""

    ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=True,
        max_length=MAX_FOTOS_POR_NEGOCIO,
        help_text=(
            "Ids de TODAS las fotos del negocio, en el orden en que deben "
            "mostrarse. Una lista parcial se rechaza."
        ),
    )

    def validate_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Hay ids repetidos en la lista.")
        return ids


class RegistroNegocioRespuestaSerializer(serializers.Serializer):
    """Forma de la respuesta de POST /api/negocios/registro/."""

    negocio = NegocioSerializer()
    access = serializers.CharField()
    refresh = serializers.CharField()


class MiembroNegocioSerializer(serializers.ModelSerializer):
    """Un miembro visto desde la gestión del equipo.

    Ya no lleva flags `puede_*`: las capacidades viven en el cargo. Se
    envía `cargo` (el id, que es lo editable) y `cargo_detalle` anidado
    para que la UI muestre el nombre y lo que concede sin un segundo
    request.
    """

    email = serializers.EmailField(source="usuario.email", read_only=True)
    nombre = serializers.CharField(source="usuario.nombre", read_only=True)
    cargo_detalle = CargoSerializer(source="cargo", read_only=True)

    class Meta:
        model = MiembroNegocio
        fields = [
            "id",
            "email",
            "nombre",
            "especialidad",
            "cargo",
            "cargo_detalle",
            "activo",
        ]
        read_only_fields = ["id", "email", "nombre", "cargo_detalle"]

    def validate_cargo(self, cargo):
        request = self.context["request"]
        if cargo is not None and cargo.negocio_id != request.membresia.negocio_id:
            raise serializers.ValidationError("Ese cargo no pertenece a tu negocio.")
        return cargo

    def validate(self, datos):
        solicitante = _solicitante(self.context)
        if solicitante is None or self.instance is None or "cargo" not in datos:
            return datos
        if datos["cargo"] == self.instance.cargo:
            return datos

        try:
            validar_asignacion_de_cargo(
                solicitante=solicitante, objetivo=self.instance, cargo=datos["cargo"]
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

    Resuelve de un solo request "quién soy, en qué negocio, **qué
    experiencia de la app me toca** y qué puedo hacer":

    - `tipo` es el **discriminador de dominio** (viene del cargo). El
      frontend lo usa para decidir qué shell montar —qué navegación, qué
      pantalla inicial— sin encadenar condicionales por capacidad.
    - `cargo` trae el detalle con las capacidades, que es lo que gatea
      cada acción concreta dentro de ese shell.

    Los dos niveles son a propósito (ver `CONTRATO.md` 5.10): el tipo
    decide la forma de la app, las capacidades deciden los botones. Y
    ninguno de los dos es la barrera de seguridad — el backend exige la
    capacidad en cada endpoint.
    """

    email = serializers.EmailField(source="usuario.email", read_only=True)
    nombre = serializers.CharField(source="usuario.nombre", read_only=True)
    negocio = NegocioSerializer(read_only=True)
    cargo = CargoSerializer(read_only=True)
    # ChoiceField y no CharField para que el schema emita el enum: el
    # frontend enciende su routing con esto y necesita que TypeScript le
    # cierre la unión, no un `string` cualquiera.
    tipo = serializers.ChoiceField(choices=Cargo.Tipo.choices, read_only=True)

    class Meta:
        model = MiembroNegocio
        fields = [
            "id",
            "email",
            "nombre",
            "especialidad",
            "negocio",
            "tipo",
            "cargo",
            "activo",
        ]
        read_only_fields = fields
