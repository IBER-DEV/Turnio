"""Que el límite de uso exista de verdad, no solo en `settings`.

Sin sesión no hay a quién responsabilizar: el único freno para que alguien
llene la agenda de un local con reservas falsas es el throttling. Vale la
pena un test que falle si alguien le quita el `throttle_scope` a la vista.

Los contadores viven en el caché y son globales al proceso, así que cada
test lo limpia antes de correr — si no, el orden de ejecución decide el
resultado.
"""

import datetime

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from apps.agenda import services as agenda_services
from apps.negocios import services as negocios_services
from apps.servicios import services as servicios_services

pytestmark = pytest.mark.django_db

PASSWORD = "claveSegura123"


@pytest.fixture(autouse=True)
def caché_limpio():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def limites_bajos(monkeypatch):
    """Baja los límites para no tener que hacer 121 requests en un test.

    Se parchea el diccionario de la clase y no `settings`: DRF lee
    `SimpleRateThrottle.THROTTLE_RATES` **una vez, al importar**, así que
    `override_settings(REST_FRAMEWORK=…)` no lo alcanza. Costó descubrirlo
    porque el test pasaba aislado y fallaba junto a los demás.
    """
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "publico_lectura", "3/min")
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "publico_reserva", "2/hour")


@pytest.fixture
def barberia(db):
    negocio, _dueno, _membresia = negocios_services.registrar_negocio(
        nombre_negocio="Barbería Límite",
        email_dueno="limite@test.com",
        password_dueno=PASSWORD,
        nombre_dueno="Dueño",
    )
    servicio = servicios_services.crear_servicio(
        negocio=negocio, nombre="Corte", precio="20000", duracion_minutos=30
    )
    agenda_services.reemplazar_horario_negocio(
        negocio=negocio,
        franjas=[
            {"dia_semana": dia, "hora_inicio": datetime.time(9, 0), "hora_fin": datetime.time(18, 0)}
            for dia in range(7)
        ],
    )
    return negocio, servicio


def test_la_lectura_publica_tiene_limite(barberia, limites_bajos):
    negocio, _servicio = barberia
    anonimo = APIClient()

    codigos = [
        anonimo.get(f"/api/publico/negocios/{negocio.slug}/").status_code for _ in range(4)
    ]

    assert codigos[:3] == [200, 200, 200]
    assert codigos[3] == 429


def test_reservar_tiene_un_limite_mas_estricto_que_leer(barberia, limites_bajos):
    """Escribir es caro y humanamente lento: nadie reserva veinte citas
    seguidas de verdad."""
    negocio, servicio = barberia
    anonimo = APIClient()
    hoy = timezone.localdate()
    lunes = hoy + datetime.timedelta(days=(7 - hoy.weekday()) % 7 + 7)

    def reservar(minuto):
        cuando = timezone.make_aware(
            datetime.datetime.combine(lunes, datetime.time(10, minuto))
        )
        return anonimo.post(
            f"/api/publico/negocios/{negocio.slug}/reservar/",
            {
                "servicio": servicio.id,
                "fecha_hora_inicio": cuando.isoformat(),
                "nombre_cliente": "Bot",
                "telefono_cliente": "3000000000",
            },
            format="json",
        ).status_code

    assert reservar(0) == 201
    assert reservar(30) == 201
    assert reservar(45) == 429
    # Y no dejó una tercera cita a medio crear.
    assert negocio.citas.count() == 2
