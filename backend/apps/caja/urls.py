from rest_framework.routers import DefaultRouter

from apps.caja.views import CajaViewSet, VentaViewSet

router = DefaultRouter()
# `ventas` va antes que la ruta vacía: el router de la caja se registra en
# el prefijo `""`, así que si se registrara al revés, `/api/caja/ventas/`
# lo tomaría `CajaViewSet` como el detalle de una caja con pk "ventas".
router.register("ventas", VentaViewSet, basename="venta")
router.register("", CajaViewSet, basename="caja")

urlpatterns = router.urls
