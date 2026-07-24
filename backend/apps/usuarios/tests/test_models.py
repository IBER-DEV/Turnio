import pytest
from django.db import IntegrityError

from apps.negocios.models import Negocio
from apps.tenants.models import Tenant
from apps.usuarios.models import MiembroNegocio, Usuario

pytestmark = pytest.mark.django_db


def test_create_user_normaliza_email_y_encripta_password():
    usuario = Usuario.objects.create_user(
        email="Dueno@Ejemplo.com", password="claveSegura123", nombre="Dueño"
    )

    assert usuario.email == "Dueno@ejemplo.com"
    assert usuario.check_password("claveSegura123")
    assert usuario.has_usable_password()


def test_no_permite_dos_membresias_del_mismo_usuario_en_el_mismo_negocio():
    tenant = Tenant.objects.create(nombre="Cuenta 1")
    negocio = Negocio.objects.create(tenant=tenant, nombre="Barbería Uno")
    usuario = Usuario.objects.create_user(email="a@b.com", password="x", nombre="A")

    MiembroNegocio.objects.create(tenant=tenant, negocio=negocio, usuario=usuario)

    with pytest.raises(IntegrityError):
        MiembroNegocio.objects.create(tenant=tenant, negocio=negocio, usuario=usuario)
