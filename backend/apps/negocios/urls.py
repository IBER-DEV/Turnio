from django.urls import path

from apps.negocios.views import (
    EmpleadoDetailView,
    EmpleadoListCreateView,
    RegistroNegocioView,
)

urlpatterns = [
    path("registro/", RegistroNegocioView.as_view(), name="negocio-registro"),
    path("empleados/", EmpleadoListCreateView.as_view(), name="negocio-empleados"),
    path(
        "empleados/<int:pk>/",
        EmpleadoDetailView.as_view(),
        name="negocio-empleado-detalle",
    ),
]
