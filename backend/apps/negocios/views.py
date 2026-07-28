from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework import serializers as drf_serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.permissions import TieneMembresiaActiva, requiere_capacidad
from apps.negocios import services
from apps.negocios.models import FotoNegocio
from apps.negocios.serializers import (
    CargoSerializer,
    EmpleadoAltaSerializer,
    FotoNegocioSerializer,
    MiembroEquipoSerializer,
    MiembroNegocioSerializer,
    MiMembresiaSerializer,
    MiNegocioSerializer,
    NegocioSerializer,
    OrdenFotosSerializer,
    RegistroNegocioRespuestaSerializer,
    RegistroNegocioSerializer,
)
from apps.usuarios.models import Cargo


class RegistroNegocioView(APIView):
    """Alta de un negocio nuevo, sus cargos de arranque y su dueño.

    El negocio nace con tres cargos editables (Administración, Recepción,
    Barbero o estilista) y el dueño entra en el de Administración. Los
    empleados que vengan en el mismo request entran al cargo operativo;
    cambiarles el cargo es un paso posterior ya autenticado."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=RegistroNegocioSerializer,
        responses={201: RegistroNegocioRespuestaSerializer},
    )
    def post(self, request):
        serializer = RegistroNegocioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        negocio, dueno, _membresia = services.registrar_negocio(
            nombre_negocio=datos["nombre_negocio"],
            ciudad=datos.get("ciudad", ""),
            direccion=datos.get("direccion", ""),
            telefono=datos.get("telefono", ""),
            email_dueno=datos["email_dueno"],
            nombre_dueno=datos["nombre_dueno"],
            password_dueno=datos["password_dueno"],
        )

        # Sin cargo explícito: entran al operativo sembrado. Asignarles
        # otro es un paso posterior, ya autenticado (ver
        # `EmpleadoAltaRegistroSerializer`).
        for empleado in datos.get("empleados", []):
            services.agregar_empleado(
                negocio=negocio,
                email=empleado["email"],
                password=empleado["password"],
                nombre=empleado["nombre"],
                especialidad=empleado.get("especialidad", ""),
            )

        refresh = RefreshToken.for_user(dueno)
        return Response(
            {
                # Con contexto para que `logo` salga como URL absoluta,
                # igual que en el resto de endpoints (acá siempre viene
                # vacío, pero la forma del campo no debe depender de por
                # qué endpoint se pidió).
                "negocio": NegocioSerializer(negocio, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    post=extend_schema(
        request=EmpleadoAltaSerializer,
        responses={201: MiembroNegocioSerializer},
    ),
)
class EmpleadoListCreateView(generics.ListCreateAPIView):
    """Lista o agrega empleados del negocio del usuario autenticado.

    Endpoint de **gestión**: expone email y capacidades de cada miembro,
    así que exige `puede_gestionar_empleados` también para listar, no
    solo para crear. Quien solo necesita saber quiénes son sus
    compañeros (la agenda) usa `GET /api/negocios/equipo/`, que
    devuelve una vista mínima sin datos personales.

    El queryset se filtra siempre por el negocio de la membresía activa
    del solicitante: nunca se exponen empleados de otro tenant.
    """

    serializer_class = MiembroNegocioSerializer
    permission_classes = [requiere_capacidad("puede_gestionar_empleados")]

    def get_queryset(self):
        return self.request.membresia.negocio.miembros.select_related("usuario").all()

    def create(self, request, *args, **kwargs):
        # El contexto lleva el request para que el serializer pueda aplicar
        # la regla de "nadie concede una capacidad que no tiene".
        serializer = EmpleadoAltaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        _usuario, membresia = services.agregar_empleado(
            negocio=request.membresia.negocio,
            email=datos["email"],
            password=datos["password"],
            nombre=datos["nombre"],
            especialidad=datos.get("especialidad", ""),
            cargo=datos.get("cargo"),
        )
        return Response(
            MiembroNegocioSerializer(membresia, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MiMembresiaView(generics.RetrieveAPIView):
    """Quién soy, en qué negocio y qué puedo hacer.

    Pensado para que el frontend lo llame justo después de loguearse
    (o al recuperar sesión desde tokens guardados) y resuelva de una
    sola vez sus propias capacidades + los datos del negocio, sin
    tener que listar empleados y buscarse a sí mismo por email.
    """

    serializer_class = MiMembresiaSerializer
    permission_classes = [TieneMembresiaActiva]

    def get_object(self):
        return self.request.membresia


class EmpleadoDetailView(generics.RetrieveUpdateAPIView):
    """Detalle y edición de un empleado puntual del negocio.

    Tanto ver como editar requieren `puede_gestionar_empleados`: el
    detalle incluye email y capacidades, que son datos de gestión. Nunca
    expone empleados de otro tenant: el queryset ya viene acotado al
    negocio de la membresía del solicitante.
    """

    serializer_class = MiembroNegocioSerializer
    permission_classes = [requiere_capacidad("puede_gestionar_empleados")]

    def get_queryset(self):
        return self.request.membresia.negocio.miembros.select_related("usuario").all()


class CargoViewSet(viewsets.ModelViewSet):
    """Los cargos que define **este** negocio.

    No hay catálogo global: cada negocio nace con tres cargos de arranque
    (`sembrar_cargos_iniciales`) y desde ahí los renombra, los edita, crea
    otros o borra los que no usa.

    Leer solo requiere pertenecer al negocio —la UI necesita mostrar en
    qué cargo está cada quien— pero escribir exige
    `puede_gestionar_empleados`, igual que tocar a un empleado: definir lo
    que puede hacer un cargo **es** dar permisos.
    """

    serializer_class = CargoSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_gestionar_empleados")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Cargo.objects.none()
        return self.request.membresia.negocio.cargos.all()

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.membresia.tenant, negocio=self.request.membresia.negocio
        )

    def perform_destroy(self, instance):
        # `on_delete=PROTECT` ya lo impediría, pero como `IntegrityError`
        # crudo (500). Acá se explica qué hacer.
        if instance.miembros.exists():
            raise drf_serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Ese cargo lo tiene alguien del equipo. Cámbiale el cargo a esas "
                        "personas antes de borrarlo."
                    ]
                }
            )
        instance.delete()


class MiNegocioView(generics.RetrieveUpdateAPIView):
    """La ficha del negocio propio: verla y editarla.

    Leer solo exige pertenecer al negocio (cualquiera necesita saber en
    qué local trabaja, y `mi-membresia` ya lo devuelve anidado). Editar
    exige `puede_editar_negocio`: quien decide cómo se llama y qué logo
    lleva el local no es necesariamente quien administra el equipo ni
    quien pone los precios, por eso es una capacidad propia y no un uso
    más de `puede_gestionar_empleados`.

    Solo PATCH, no PUT: el formulario es parcial por naturaleza (subir un
    logo no debería obligar a reenviar la dirección) y con `multipart` un
    PUT haría fácil borrar campos sin querer.
    """

    serializer_class = MiNegocioSerializer
    # Explícito aunque hoy coincida con el default de DRF: este endpoint
    # recibe un archivo, y eso no debería depender de que nadie toque
    # `DEFAULT_PARSER_CLASSES` más adelante.
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_editar_negocio")()]

    def get_object(self):
        return self.request.membresia.negocio

    def perform_update(self, serializer):
        # El servicio se encarga del efecto de lado que un `save()` pelado
        # no tiene: borrar del disco el logo que se reemplaza.
        services.actualizar_negocio(
            negocio=serializer.instance, datos=serializer.validated_data
        )


class FotoNegocioListCreateView(generics.ListCreateAPIView):
    """La galería del perfil público: listarla y subirle fotos.

    Listar solo exige pertenecer al negocio —son fotos que de todos modos
    están publicadas—, subir exige `puede_editar_negocio`.
    """

    serializer_class = FotoNegocioSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_editar_negocio")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FotoNegocio.objects.none()
        return self.request.membresia.negocio.fotos.all()

    def perform_create(self, serializer):
        try:
            foto = services.agregar_foto(
                negocio=self.request.membresia.negocio,
                imagen=serializer.validated_data["imagen"],
            )
        except services.LimiteDeFotosAlcanzado as error:
            raise drf_serializers.ValidationError({"non_field_errors": [str(error)]})
        serializer.instance = foto


class FotoNegocioDetailView(generics.DestroyAPIView):
    """Borra una foto de la galería, y su archivo del disco.

    El queryset viene acotado al negocio de quien pide: una foto de otro
    negocio responde 404, igual que una inexistente (`CONTRATO.md` 5.2).
    """

    serializer_class = FotoNegocioSerializer
    permission_classes = [requiere_capacidad("puede_editar_negocio")]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FotoNegocio.objects.none()
        return self.request.membresia.negocio.fotos.all()

    def perform_destroy(self, instance):
        services.eliminar_foto(foto=instance)


class OrdenFotosView(APIView):
    """`PUT /api/negocios/mi-negocio/fotos/orden/` — reordena el carrusel.

    En lote y con la lista completa, siguiendo el mismo criterio que
    `PUT /api/agenda/horarios/semana/` y `POST /api/servicios/lote/`:
    arrastrar cinco fotos es un gesto, no cinco, y partirlo en cinco
    requests deja órdenes intermedios visibles en el perfil público.
    """

    permission_classes = [requiere_capacidad("puede_editar_negocio")]

    @extend_schema(
        request=OrdenFotosSerializer,
        responses={200: FotoNegocioSerializer(many=True)},
    )
    def put(self, request):
        entrada = OrdenFotosSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            fotos = services.reordenar_fotos(
                negocio=request.membresia.negocio, ids=entrada.validated_data["ids"]
            )
        except services.OrdenDeFotosInvalido as error:
            raise drf_serializers.ValidationError({"ids": [str(error)]})
        return Response(
            FotoNegocioSerializer(fotos, many=True, context={"request": request}).data
        )


class EquipoListView(generics.ListAPIView):
    """Directorio mínimo del equipo, para cualquier miembro del negocio.

    Devuelve solo `id`, `nombre`, `especialidad` y `activo`: lo que la
    agenda necesita para filtrar el calendario, ofrecer "cualquiera
    disponible" y cargar horarios, sin exponer email ni capacidades.

    Separado de `/empleados/` a propósito: así cada endpoint tiene una
    forma honesta en el schema, en vez de un mismo endpoint que devuelve
    más o menos campos según quién pregunte.
    """

    serializer_class = MiembroEquipoSerializer
    permission_classes = [TieneMembresiaActiva]

    def get_queryset(self):
        return self.request.membresia.negocio.miembros.select_related("usuario").all()
