from django.urls import path

from apps.negocios.views import EmpleadoListCreateView, RegistroNegocioView

urlpatterns = [
    path("registro/", RegistroNegocioView.as_view(), name="negocio-registro"),
    path("empleados/", EmpleadoListCreateView.as_view(), name="negocio-empleados"),
]
