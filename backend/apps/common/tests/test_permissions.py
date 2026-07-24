import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from apps.common.permissions import TieneMembresiaActiva, requiere_capacidad

pytestmark = pytest.mark.django_db


def test_tiene_membresia_activa_rechaza_usuario_anonimo_sin_explotar():
    """Regresión: antes, un request sin autenticar hacía que
    obtener_membresia_activa() reventara con AttributeError
    ('AnonymousUser' no tiene .membresias), devolviendo 500 en vez de
    401. Cualquier vista que use esta permission (todos los endpoints
    de Fase 1 y de empleados) estaba expuesta a esto."""
    request = RequestFactory().get("/")
    request.user = AnonymousUser()

    assert TieneMembresiaActiva().has_permission(request, view=None) is False


def test_requiere_capacidad_tambien_rechaza_usuario_anonimo_sin_explotar():
    request = RequestFactory().get("/")
    request.user = AnonymousUser()

    permiso = requiere_capacidad("puede_gestionar_agenda")()
    assert permiso.has_permission(request, view=None) is False
