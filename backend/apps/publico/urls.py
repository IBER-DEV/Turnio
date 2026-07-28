from django.urls import path

from apps.publico.views import (
    BuscarNegociosView,
    DisponibilidadView,
    PerfilNegocioView,
    ReservarView,
)

urlpatterns = [
    path("negocios/", BuscarNegociosView.as_view(), name="publico-buscar"),
    path("negocios/<slug:slug>/", PerfilNegocioView.as_view(), name="publico-perfil"),
    path(
        "negocios/<slug:slug>/disponibilidad/",
        DisponibilidadView.as_view(),
        name="publico-disponibilidad",
    ),
    path("negocios/<slug:slug>/reservar/", ReservarView.as_view(), name="publico-reservar"),
]
