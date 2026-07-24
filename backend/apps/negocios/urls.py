from django.urls import path

from apps.negocios.views import (
    EmpleadoDetailView,
    EmpleadoListCreateView,
    MiMembresiaView,
    RegistroNegocioView,
)

urlpatterns = [
    path("registro/", RegistroNegocioView.as_view(), name="negocio-registro"),
    path("mi-membresia/", MiMembresiaView.as_view(), name="negocio-mi-membresia"),
    path("empleados/", EmpleadoListCreateView.as_view(), name="negocio-empleados"),
    path(
        "empleados/<int:pk>/",
        EmpleadoDetailView.as_view(),
        name="negocio-empleado-detalle",
    ),
]
