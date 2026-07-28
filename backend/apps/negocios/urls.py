from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.negocios.views import (
    CargoViewSet,
    EmpleadoDetailView,
    EmpleadoListCreateView,
    EquipoListView,
    MiMembresiaView,
    RegistroNegocioView,
)

router = DefaultRouter()
router.register("cargos", CargoViewSet, basename="cargo")

urlpatterns = [
    path("registro/", RegistroNegocioView.as_view(), name="negocio-registro"),
    path("mi-membresia/", MiMembresiaView.as_view(), name="negocio-mi-membresia"),
    path("equipo/", EquipoListView.as_view(), name="negocio-equipo"),
    path("empleados/", EmpleadoListCreateView.as_view(), name="negocio-empleados"),
    path(
        "empleados/<int:pk>/",
        EmpleadoDetailView.as_view(),
        name="negocio-empleado-detalle",
    ),
    *router.urls,
]
