from rest_framework.permissions import BasePermission

from apps.common.services import obtener_membresia_activa


class TieneMembresiaActiva(BasePermission):
    """Exige que el usuario autenticado pertenezca a un negocio activo.

    Además, adjunta la membresía resuelta en `request.membresia` para que
    vistas y serializers no tengan que volver a resolverla.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        membresia = obtener_membresia_activa(request.user)
        if membresia is None:
            return False
        request.membresia = membresia
        return True


def requiere_capacidad(nombre_capacidad):
    """Factory de permisos DRF para exigir una capacidad puntual.

    Uso: `permission_classes = [requiere_capacidad("puede_gestionar_empleados")]`
    """

    class _RequiereCapacidad(TieneMembresiaActiva):
        def has_permission(self, request, view):
            if not super().has_permission(request, view):
                return False
            return getattr(request.membresia, nombre_capacidad, False)

    _RequiereCapacidad.__name__ = f"Requiere_{nombre_capacidad}"
    return _RequiereCapacidad
