from rest_framework import viewsets

from apps.common.permissions import TieneMembresiaActiva, requiere_capacidad
from apps.servicios.models import Servicio
from apps.servicios.serializers import ServicioSerializer


class ServicioViewSet(viewsets.ModelViewSet):
    """CRUD de servicios del negocio del usuario autenticado.

    Leer requiere solo pertenecer al negocio; crear/editar/borrar
    requiere la capacidad `puede_editar_precios`, porque un servicio
    define precio y comisión.
    """

    serializer_class = ServicioSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [TieneMembresiaActiva()]
        return [requiere_capacidad("puede_editar_precios")()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Servicio.objects.none()
        return self.request.membresia.negocio.servicios.all()

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.membresia.tenant, negocio=self.request.membresia.negocio
        )
