from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.publico.views_shell import PerfilPublicoShellView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/negocios/", include("apps.negocios.urls")),
    path("api/servicios/", include("apps.servicios.urls")),
    path("api/agenda/", include("apps.agenda.urls")),
    path("api/publico/", include("apps.publico.urls")),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

if settings.DEBUG:
    # Sirve `frontend/dist/` para poder probar `PerfilPublicoShellView`
    # en local sin montar un servidor de estáticos aparte. **No es una
    # solución de despliegue**: en producción esto lo sirve un servidor
    # de estáticos de verdad (nginx, o lo que decida la infraestructura
    # que todavía no existe en este repo — ver ROADMAP-BACKEND.md), no
    # Django. `django.views.static.serve` está explícitamente marcado
    # como inseguro/ineficiente para producción por la propia
    # documentación de Django.
    _frontend_dist = Path(settings.BASE_DIR).parent / "frontend" / "dist"
    urlpatterns += [
        re_path(
            r"^assets/(?P<path>.*)$",
            static_serve,
            {"document_root": _frontend_dist / "assets"},
        ),
        path(
            "favicon.svg",
            static_serve,
            {"document_root": _frontend_dist, "path": "favicon.svg"},
        ),
    ]

urlpatterns += [
    # Debe ir al final: es un catch-all de un segmento
    # (`<slug:slug>/`) y cualquier ruta literal de arriba (`admin/`,
    # `api/...`) tiene que resolverse primero. `Negocio._slug_ocupado`
    # ya impide que un negocio tome `login`, `agenda`, `api`, etc.
    # (`SLUGS_RESERVADOS`), así que esta vista solo compite consigo
    # misma: un slug real de negocio, o 404.
    path("<slug:slug>/", PerfilPublicoShellView.as_view(), name="perfil-publico-shell"),
]
