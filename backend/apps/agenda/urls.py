from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.agenda.views import CitaViewSet, HorarioNegocioView, HorarioTrabajoViewSet

router = DefaultRouter()
router.register("horarios", HorarioTrabajoViewSet, basename="horario")
router.register("citas", CitaViewSet, basename="cita")

urlpatterns = [
    path("horario-negocio/", HorarioNegocioView.as_view(), name="horario-negocio"),
    *router.urls,
]
