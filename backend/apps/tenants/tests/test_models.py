import pytest

from apps.tenants.models import Tenant

pytestmark = pytest.mark.django_db


def test_crea_tenant_activo_por_defecto():
    tenant = Tenant.objects.create(nombre="Barbería El Corte")

    assert tenant.activo is True
    assert str(tenant) == "Barbería El Corte"
