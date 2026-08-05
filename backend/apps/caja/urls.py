from rest_framework.routers import DefaultRouter

from apps.caja.views import CajaViewSet

router = DefaultRouter()
router.register("", CajaViewSet, basename="caja")

urlpatterns = router.urls
