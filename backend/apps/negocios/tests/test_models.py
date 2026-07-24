import pytest

from apps.negocios.models import Negocio
from apps.tenants.models import Tenant

pytestmark = pytest.mark.django_db


def test_genera_slug_a_partir_del_nombre():
    tenant = Tenant.objects.create(nombre="Barbería El Corte")
    negocio = Negocio.objects.create(tenant=tenant, nombre="Barbería El Corte")

    assert negocio.slug == "barberia-el-corte"


def test_evita_slugs_duplicados_entre_negocios():
    tenant = Tenant.objects.create(nombre="Cuenta 1")
    otro_tenant = Tenant.objects.create(nombre="Cuenta 2")

    primero = Negocio.objects.create(tenant=tenant, nombre="Salón Bella")
    segundo = Negocio.objects.create(tenant=otro_tenant, nombre="Salón Bella")

    assert primero.slug != segundo.slug
    assert segundo.slug == "salon-bella-2"
