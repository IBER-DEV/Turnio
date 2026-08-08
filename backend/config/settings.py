import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-change-me")
DEBUG = os.environ.get("DEBUG", "0") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# En desarrollo se acepta cualquier host. Es lo que permite abrir la app
# desde un **celular de la misma red** (`http://192.168.x.x:5173`, que le
# pega al backend en `:8001` de esa misma IP): con la lista fija, Django
# respondía `400 Bad Request` a todo lo que no viniera de `localhost`, y
# el síntoma en el teléfono era "este negocio no existe" y un login que
# no entra — sin nada que apuntara a la causa.
#
# Importante para un producto que es una app Capacitor: probar en un
# teléfono real no puede depender de acordarse de poner la IP del día en
# un `.env`, porque el router la cambia.
#
# **Solo aplica con `DEBUG=1`.** En producción `DEBUG=0` y la lista
# explícita vuelve a ser obligatoria, que es donde importa: `ALLOWED_HOSTS`
# es la defensa contra cabeceras `Host` falsificadas.
if DEBUG:
    ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "corsheaders",
    "apps.common",
    "apps.tenants",
    "apps.negocios",
    "apps.usuarios",
    "apps.servicios",
    "apps.agenda",
    "apps.caja",
    "apps.publico",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "turnio"),
        "USER": os.environ.get("POSTGRES_USER", "turnio"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "turnio"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "usuarios.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

# Imágenes subidas por los negocios (logo y galería del perfil público).
# `MEDIA_ROOT` queda dentro de `backend/` y está en `.gitignore` desde
# antes. Es almacenamiento **local en disco**: sirve para desarrollo y
# para un despliegue de un solo servidor, pero no para varios contenedores
# sin volumen compartido — migrar a S3/R2 con `django-storages` es una
# decisión de infraestructura pendiente, igual que cómo se sirve
# `frontend/dist/` (ver ROADMAP-BACKEND.md).
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Los endpoints públicos (Fase 2) no tienen sesión detrás, así que el
    # único sujeto al que limitar es la IP. Se aplican por `throttle_scope`
    # en cada vista, no globalmente: el staff autenticado no debería
    # toparse con un límite pensado para internet abierto.
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        # Navegar un perfil y consultar horarios es barato y frecuente:
        # un cliente indeciso mira varios días seguidos.
        "publico_lectura": "120/min",
        # Reservar es caro (escribe) y humanamente lento. Un límite bajo
        # corta el llenado automático de la agenda de un local sin
        # estorbarle a nadie real.
        "publico_reserva": "10/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Turnio API",
    "DESCRIPTION": (
        "Contrato vivo entre el backend y el frontend de Turnio. "
        "Ver también /CONTRATO.md en la raíz del repo para convenciones "
        "que este schema no captura (auth, formato de errores, etc.)."
    ),
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # `Cargo.tipo` y `MovimientoCaja.tipo`/`Caja.estado` comparten nombre
    # de campo con otros `TextChoices` del proyecto (`Cita.estado`,
    # `Venta.estado`). drf-spectacular resuelve las colisiones de "estado"
    # automáticamente (`CitaEstadoEnum`/`VentaEstadoEnum`), pero cuando
    # `Caja.estado` entró como tercer "estado" lo empujó a un nombre con
    # hash ilegible (`Estado36eEnum`) y además le movió el nombre limpio a
    # `Cargo.tipo` (`Tipo14fEnum`) — que el frontend ya usa por nombre
    # fijo (`components["schemas"]["TipoEnum"]` en `permisos/catalogo.ts`).
    # Se fijan los nombres a mano para que una colisión nueva no le cambie
    # el nombre a un tipo que ya existía.
    "ENUM_NAME_OVERRIDES": {
        "TipoEnum": "apps.usuarios.models.Cargo.Tipo",
        "CajaEstadoEnum": "apps.caja.models.Caja.Estado",
        # `MetodoPago` es un solo `TextChoices` compartido por
        # `MovimientoCaja`, `Pago` y `Devolucion` — que es justamente lo
        # que se quería (un cobro y su devolución hablan del mismo
        # método). drf-spectacular ve el mismo conjunto de opciones
        # llegando por tres caminos distintos y avisa; se le fija el
        # nombre para que quede un único `MetodoPagoEnum` en el schema y
        # el frontend no tenga tres tipos idénticos.
        "MetodoPagoEnum": "apps.caja.models.MetodoPago",
        # `Venta.Estado` llega por dos caminos (el propio `VentaSerializer`
        # y el `venta_estado` que `CitaSerializer` expone), y sin fijarlo
        # drf-spectacular resolvía la colisión de "estado" con un hash
        # (`Estado76aEnum`) — ilegible y, peor, inestable: cambia si se
        # agrega otro "estado" en cualquier app.
        "VentaEstadoEnum": "apps.caja.models.Venta.Estado",
        # Sin esto queda `CategoriaEnum` a secas, por el nombre del campo:
        # un nombre demasiado genérico para el schema compartido, que el
        # día que exista cualquier otra "categoria" (servicios, productos)
        # se convierte en una colisión con hash.
        "CategoriaEgresoEnum": "apps.caja.models.MovimientoCaja.CategoriaEgreso",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
}

CORS_ALLOWED_ORIGINS = [
    origin
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin
]
CORS_ALLOW_ALL_ORIGINS = DEBUG and not CORS_ALLOWED_ORIGINS
