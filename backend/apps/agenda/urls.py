from rest_framework.routers import DefaultRouter

from apps.agenda.views import CitaViewSet, HorarioTrabajoViewSet

router = DefaultRouter()
router.register("horarios", HorarioTrabajoViewSet, basename="horario")
router.register("citas", CitaViewSet, basename="cita")

urlpatterns = router.urls
