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
    "puede_configurar_horarios": True,
    "puede_ver_agenda_completa": True,
}

CAMPOS_CAPACIDADES = list(CAPACIDADES_OPERADOR_UNICO.keys())


class CambioDeCapacidadNoPermitido(Exception):
    """El solicitante no puede hacer ese cambio de capacidades."""


def validar_cambio_de_capacidades(*, solicitante, capacidades_pedidas, objetivo=None):
    """Reglas que acotan a quien tiene `puede_gestionar_empleados`.

    Sin ellas, esa capacidad era una escalada de privilegios completa: el
    endpoint de edición de empleados acepta los flags `puede_*` y su
    queryset incluye la propia membresía del solicitante, así que
    cualquiera que pudiera gestionar el equipo podía concederse el resto
    de capacidades con un solo PATCH sobre sí mismo.

    Dos reglas, ambas sobre el mismo principio de que un permiso lo
    concede alguien que ya lo tiene y no uno mismo:

    1. **Nadie edita sus propias capacidades.** Que otro te las cambie es
       administración; cambiártelas tú es auto-ascenso. Editar tu propia
       `especialidad` sí se permite: no es una capacidad.
    2. **Nadie concede una capacidad que no tiene.** Si no puedes editar
       precios, no puedes habilitar a otro a que lo haga — si no, la
       regla 1 se esquiva en dos pasos con un cómplice.

    Quitar una capacidad que uno no tiene sí se permite: reducir permisos
    ajenos no amplía los propios, y bloquearlo dejaría a un administrador
    sin poder frenar a alguien con más capacidades que él.

    `capacidades_pedidas` es un dict parcial {campo: bool} con solo lo que
    el request pretende cambiar. `objetivo` es `None` al dar de alta a
    alguien nuevo, donde la regla 1 no aplica: un empleado que aún no
    existe no puede ser uno mismo.
    """
    if not capacidades_pedidas:
        return

    if objetivo is not None and solicitante.pk == objetivo.pk:
        raise CambioDeCapacidadNoPermitido(
            "No puedes cambiar tus propias capacidades. Pídeselo a otra "
            "persona que gestione el equipo."
        )

    concedidas_sin_tenerlas = sorted(
        campo
        for campo, valor in capacidades_pedidas.items()
        if valor and not getattr(solicitante, campo, False)
    )
    if concedidas_sin_tenerlas:
        raise CambioDeCapacidadNoPermitido(
            "No puedes conceder una capacidad que tú no tienes: "
            + ", ".join(concedidas_sin_tenerlas)
        )


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
def agregar_empleado(*, negocio, email, password, nombre, especialidad="", capacidades=None):
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
        tenant=negocio.tenant,
        negocio=negocio,
        usuario=usuario,
        especialidad=especialidad,
        **capacidades_validas,
    )
    return usuario, membresia
