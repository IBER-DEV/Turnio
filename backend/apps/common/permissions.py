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


def requiere_capacidad_o_ser_titular(nombre_capacidad, campo_titular):
    """Permite la acción si el usuario tiene la capacidad —que lo habilita
    sobre **cualquier** objeto— o si el objeto en cuestión es suyo.

    Modela la diferencia entre administrar y trabajar: `puede_gestionar_agenda`
    significa "gestionar la agenda del negocio", pero un empleado sin esa
    capacidad igual debe poder marcar que su propio cliente llegó. Eso no es
    un permiso que el dueño conceda, es propiedad: siempre puedes actuar
    sobre tu propio trabajo. Por eso no se modeló como una capacidad nueva.

    `campo_titular` es el nombre del FK a `MiembroNegocio` que marca de
    quién es el objeto (ej. `"empleado"` en `Cita`).

    Ojo: solo aplica a acciones **con objeto**. Una vista que lo use para
    `create` dejaría pasar a cualquier miembro, porque ahí no hay objeto
    contra el cual comprobar propiedad — para crear, sigue usándose
    `requiere_capacidad`.
    """

    class _RequiereCapacidadOSerTitular(TieneMembresiaActiva):
        def has_object_permission(self, request, view, obj):
            if getattr(request.membresia, nombre_capacidad, False):
                return True
            return getattr(obj, f"{campo_titular}_id", None) == request.membresia.id

    _RequiereCapacidadOSerTitular.__name__ = (
        f"Requiere_{nombre_capacidad}_o_ser_{campo_titular}"
    )
    return _RequiereCapacidadOSerTitular
