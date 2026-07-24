from django.db import transaction

from apps.negocios.models import Negocio
from apps.tenants.models import Tenant
from apps.usuarios.models import MiembroNegocio, Usuario

CAPACIDADES_OPERADOR_UNICO = {
    "puede_cobrar": True,
    "puede_ver_reportes": True,
    "puede_editar_precios": True,
    "puede_gestionar_empleados": True,
    "puede_gestionar_agenda": True,
}

CAMPOS_CAPACIDADES = list(CAPACIDADES_OPERADOR_UNICO.keys())


@transaction.atomic
def registrar_negocio(*, nombre_negocio, email_dueno, password_dueno, nombre_dueno, **datos_negocio):
    """Crea Tenant + Negocio + Usuario dueño + su membresía con todas las capacidades.

    Este es el flujo de alta para el caso n=1 (operador único): el dueño
    arranca con todas las capacidades sin necesidad de crear un "empleado"
    aparte. Para negocios con varios empleados, se agregan luego con
    `agregar_empleado`.
    """
    tenant = Tenant.objects.create(nombre=nombre_negocio)
    negocio = Negocio.objects.create(tenant=tenant, nombre=nombre_negocio, **datos_negocio)
    dueno = Usuario.objects.create_user(
        email=email_dueno, password=password_dueno, nombre=nombre_dueno
    )
    membresia = MiembroNegocio.objects.create(
        tenant=tenant, negocio=negocio, usuario=dueno, **CAPACIDADES_OPERADOR_UNICO
    )
    return negocio, dueno, membresia


@transaction.atomic
def agregar_empleado(*, negocio, email, password, nombre, capacidades=None):
    """Da de alta un empleado adicional en un negocio ya existente.

    `capacidades` es un dict parcial con las capacidades a otorgar
    (ej: {"puede_cobrar": True}); las no incluidas quedan en False.
    """
    capacidades = capacidades or {}
    capacidades_validas = {
        campo: bool(capacidades.get(campo, False)) for campo in CAMPOS_CAPACIDADES
    }
    usuario = Usuario.objects.create_user(email=email, password=password, nombre=nombre)
    membresia = MiembroNegocio.objects.create(
        tenant=negocio.tenant, negocio=negocio, usuario=usuario, **capacidades_validas
    )
    return usuario, membresia
