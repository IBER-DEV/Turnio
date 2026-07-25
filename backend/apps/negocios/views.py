from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.permissions import TieneMembresiaActiva, requiere_capacidad
from apps.negocios import services
from apps.negocios.serializers import (
    EmpleadoAltaSerializer,
    MiembroNegocioSerializer,
    MiMembresiaSerializer,
    NegocioSerializer,
    RegistroNegocioRespuestaSerializer,
    RegistroNegocioSerializer,
)


class RegistroNegocioView(APIView):
    """Alta de un negocio nuevo, con su dueño (todas las capacidades) y,
    opcionalmente, empleados adicionales desde el mismo registro."""

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

        for empleado in datos.get("empleados", []):
            services.agregar_empleado(
                negocio=negocio,
                email=empleado["email"],
                password=empleado["password"],
                nombre=empleado["nombre"],
                especialidad=empleado.get("especialidad", ""),
                capacidades={
                    campo: empleado.get(campo, False)
                    for campo in services.CAMPOS_CAPACIDADES
                },
            )

        refresh = RefreshToken.for_user(dueno)
        return Response(
            {
                "negocio": NegocioSerializer(negocio).data,
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

    El queryset se filtra siempre por el negocio de la membresía activa
    del solicitante: nunca se exponen empleados de otro tenant.
    """

    serializer_class = MiembroNegocioSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [requiere_capacidad("puede_gestionar_empleados")()]
        return [TieneMembresiaActiva()]

    def get_queryset(self):
        return self.request.membresia.negocio.miembros.select_related("usuario").all()

    def create(self, request, *args, **kwargs):
        serializer = EmpleadoAltaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        _usuario, membresia = services.agregar_empleado(
            negocio=request.membresia.negocio,
            email=datos["email"],
            password=datos["password"],
            nombre=datos["nombre"],
            especialidad=datos.get("especialidad", ""),
            capacidades={campo: datos.get(campo, False) for campo in services.CAMPOS_CAPACIDADES},
        )
        return Response(
            MiembroNegocioSerializer(membresia).data, status=status.HTTP_201_CREATED
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

    Editar (capacidades, especialidad, activo) requiere
    `puede_gestionar_empleados`; ver el detalle solo requiere
    pertenecer al negocio. Nunca expone empleados de otro tenant: el
    queryset ya viene acotado al negocio de la membresía del
    solicitante.
    """

    serializer_class = MiembroNegocioSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [requiere_capacidad("puede_gestionar_empleados")()]
        return [TieneMembresiaActiva()]

    def get_queryset(self):
        return self.request.membresia.negocio.miembros.select_related("usuario").all()
