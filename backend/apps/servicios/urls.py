from rest_framework.routers import DefaultRouter

from apps.servicios.views import RegistroServicioViewSet, ServicioViewSet

router = DefaultRouter()
router.register("registros", RegistroServicioViewSet, basename="registro-servicio")
router.register("", ServicioViewSet, basename="servicio")

urlpatterns = router.urls
