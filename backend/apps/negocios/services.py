from django.db import models, transaction

from apps.negocios.models import MAX_FOTOS_POR_NEGOCIO, FotoNegocio, Negocio
from apps.tenants.models import Tenant
from apps.usuarios.models import CAPACIDADES, Cargo, MiembroNegocio, Usuario

CAMPOS_CAPACIDADES = list(CAPACIDADES)

CAPACIDADES_OPERADOR_UNICO = {campo: True for campo in CAMPOS_CAPACIDADES}

#: Los cargos con que arranca un negocio nuevo. Son un punto de partida
#: editable, no un catálogo fijo: cada negocio los renombra, los cambia,
#: crea otros o borra los que no usa (ver `Cargo`). El dueño queda en el
#: primero, que es el único con todas las capacidades.
CARGOS_INICIALES = [
    {
        "nombre": "Administración",
        "tipo": Cargo.Tipo.ADMINISTRACION,
        "capacidades": list(CAMPOS_CAPACIDADES),
    },
    {
        "nombre": "Recepción",
        "tipo": Cargo.Tipo.RECEPCION,
        "capacidades": [
            "puede_cobrar",
            "puede_gestionar_agenda",
            "puede_ver_agenda_completa",
        ],
    },
    {
        "nombre": "Barbero o estilista",
        "tipo": Cargo.Tipo.OPERATIVO,
        "capacidades": [],
    },
]


def crear_cargo(*, negocio, nombre, tipo, capacidades):
    """Crea un cargo del negocio. `capacidades` es la lista de las que concede."""
    return Cargo.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        nombre=nombre,
        tipo=tipo,
        **{campo: campo in capacidades for campo in CAMPOS_CAPACIDADES},
    )


def sembrar_cargos_iniciales(negocio):
    """Deja al negocio con sus tres cargos de arranque y devuelve el de
    administración, que es donde entra el dueño."""
    creados = [
        crear_cargo(
            negocio=negocio,
            nombre=plantilla["nombre"],
            tipo=plantilla["tipo"],
            capacidades=plantilla["capacidades"],
        )
        for plantilla in CARGOS_INICIALES
    ]
    return creados[0]


class CambioDeCapacidadNoPermitido(Exception):
    """El solicitante no puede hacer ese cambio de capacidades."""


def validar_cambio_de_capacidades(*, solicitante, capacidades_pedidas, es_mi_cargo=False):
    """Reglas que acotan a quien tiene `puede_gestionar_empleados`.

    Sin ellas, esa capacidad era una escalada de privilegios completa:
    quien podía administrar el equipo podía concederse el resto de
    capacidades editando lo suyo.

    Dos reglas, ambas sobre el mismo principio de que un permiso lo
    concede alguien que ya lo tiene y no uno mismo:

    1. **Nadie amplía las capacidades del cargo que él mismo ocupa.**
       Renombrarlo o recortarlo sí se permite; agregarle capacidades es
       auto-ascenso con un paso extra.
    2. **Nadie concede una capacidad que no tiene.** Si no puedes editar
       precios, no puedes crear un cargo que lo permita — si no, la regla
       1 se esquiva creando un cargo nuevo y mudándose a él.

    **Quitar** una capacidad que uno no tiene sí se permite: reducir
    permisos ajenos no amplía los propios, y bloquearlo dejaría a un
    administrador sin poder frenar a alguien con más capacidades que él.

    `capacidades_pedidas` es un dict parcial {campo: bool} con solo lo
    que el request pretende cambiar.
    """
    if not capacidades_pedidas:
        return

    concedidas = sorted(campo for campo, valor in capacidades_pedidas.items() if valor)

    if es_mi_cargo and concedidas:
        raise CambioDeCapacidadNoPermitido(
            "No puedes agregarle capacidades al cargo que tú ocupas. "
            "Pídeselo a otra persona que gestione el equipo."
        )

    sin_tenerlas = [campo for campo in concedidas if not solicitante.tiene(campo)]
    if sin_tenerlas:
        raise CambioDeCapacidadNoPermitido(
            "No puedes conceder una capacidad que tú no tienes: "
            + ", ".join(sin_tenerlas)
        )


def validar_asignacion_de_cargo(*, solicitante, objetivo, cargo):
    """Que asignar un cargo no sea la forma barata de auto-ascenderse.

    Mudarse a un cargo con más capacidades es exactamente la misma
    escalada que editarse el propio, solo que por la puerta de al lado.
    Y darle a otro un cargo con capacidades que uno no tiene equivale a
    concedérselas.
    """
    if objetivo is not None and solicitante.pk == objetivo.pk:
        raise CambioDeCapacidadNoPermitido(
            "No puedes cambiarte el cargo a ti mismo. Pídeselo a otra "
            "persona que gestione el equipo."
        )

    if cargo is None:
        return

    sin_tenerlas = [
        campo
        for campo, valor in cargo.capacidades().items()
        if valor and not solicitante.tiene(campo)
    ]
    if sin_tenerlas:
        raise CambioDeCapacidadNoPermitido(
            "Ese cargo incluye capacidades que tú no tienes: " + ", ".join(sorted(sin_tenerlas))
        )


@transaction.atomic
def registrar_negocio(*, nombre_negocio, email_dueno, password_dueno, nombre_dueno, **datos_negocio):
    """Crea Tenant + Negocio + sus cargos de arranque + el dueño en Administración.

    El negocio nace con tres cargos ya listos para que dar de alta gente
    sea elegir uno, no configurar siete interruptores. Son editables: el
    dueño los renombra, los cambia o crea otros (ver `Cargo`).
    """
    tenant = Tenant.objects.create(nombre=nombre_negocio)
    negocio = Negocio.objects.create(tenant=tenant, nombre=nombre_negocio, **datos_negocio)
    cargo_administracion = sembrar_cargos_iniciales(negocio)
    dueno = Usuario.objects.create_user(
        email=email_dueno, password=password_dueno, nombre=nombre_dueno
    )
    membresia = MiembroNegocio.objects.create(
        tenant=tenant, negocio=negocio, usuario=dueno, cargo=cargo_administracion
    )
    return negocio, dueno, membresia


@transaction.atomic
def agregar_empleado(*, negocio, email, password, nombre, especialidad="", cargo=None):
    """Da de alta un empleado adicional en un negocio ya existente.

    `cargo` decide qué podrá hacer. Si no se pasa, entra al cargo
    operativo más acotado del negocio (el que menos capacidades concede),
    que es el default prudente: alguien recién llegado no debería
    arrancar pudiendo más de lo necesario.
    """
    if cargo is None:
        cargo = (
            negocio.cargos.filter(tipo=Cargo.Tipo.OPERATIVO).first() or negocio.cargos.first()
        )
    usuario = Usuario.objects.create_user(email=email, password=password, nombre=nombre)
    membresia = MiembroNegocio.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        usuario=usuario,
        especialidad=especialidad,
        cargo=cargo,
    )
    return usuario, membresia


#: Los campos de imagen de `Negocio`, para el barrido de archivos viejos.
CAMPOS_IMAGEN_NEGOCIO = ("logo", "portada")


def actualizar_negocio(*, negocio, datos):
    """Aplica una edición parcial de la ficha del negocio.

    Existe como servicio y no como un `serializer.save()` pelado por una
    sola razón: reemplazar una imagen tiene un efecto de lado en disco.
    Django **no** borra el archivo anterior cuando se sube uno nuevo, así
    que sin esto cada cambio de logo o de portada dejaría basura
    acumulándose en `MEDIA_ROOT` para siempre.

    El borrado va después del `save()` a propósito: si la escritura falla,
    el negocio se queda con las imágenes que ya tenía y no con campos
    apuntando a archivos que se borraron.
    """
    anteriores = {
        campo: (getattr(negocio, campo).name, getattr(negocio, campo).storage)
        for campo in CAMPOS_IMAGEN_NEGOCIO
    }

    for campo, valor in datos.items():
        setattr(negocio, campo, valor)
    negocio.save()

    for campo, (nombre_anterior, storage) in anteriores.items():
        fue_reemplazado = campo in datos and getattr(negocio, campo).name != nombre_anterior
        if fue_reemplazado and nombre_anterior:
            storage.delete(nombre_anterior)
    return negocio


class LimiteDeFotosAlcanzado(Exception):
    """El negocio ya tiene todas las fotos que admite la galería."""


def agregar_foto(*, negocio, imagen):
    """Suma una foto al final de la galería.

    Al final y no al principio: quien sube una foto nueva no está diciendo
    que sea la más importante, solo que existe. Reordenar es un gesto
    aparte y explícito (`reordenar_fotos`).
    """
    if negocio.fotos.count() >= MAX_FOTOS_POR_NEGOCIO:
        raise LimiteDeFotosAlcanzado(
            f"Tu galería ya tiene el máximo de {MAX_FOTOS_POR_NEGOCIO} fotos. "
            "Borra alguna para subir otra."
        )
    maximo = negocio.fotos.aggregate(models.Max("orden"))["orden__max"]
    return FotoNegocio.objects.create(
        tenant=negocio.tenant,
        negocio=negocio,
        imagen=imagen,
        orden=0 if maximo is None else maximo + 1,
    )


def eliminar_foto(*, foto):
    """Borra la foto y su archivo. Misma razón que en `actualizar_negocio`:
    `Model.delete()` no toca el disco desde Django 1.3."""
    nombre = foto.imagen.name
    storage = foto.imagen.storage
    foto.delete()
    if nombre:
        storage.delete(nombre)


class OrdenDeFotosInvalido(Exception):
    """La lista de ids recibida no describe la galería de este negocio."""


@transaction.atomic
def reordenar_fotos(*, negocio, ids):
    """Fija el orden del carrusel a partir de la lista completa de ids.

    Se exige la lista **completa** —no un subconjunto ni un par
    (id, posición)— porque el orden es una propiedad del conjunto: con
    una lista parcial habría que inventar dónde caen las que faltan, y
    dos clientes reordenando a medias dejarían un orden que ninguno de
    los dos pidió. Mandar todo hace la operación idempotente y hace que
    el último request gane, entero.
    """
    actuales = list(negocio.fotos.values_list("id", flat=True))
    if sorted(ids) != sorted(actuales):
        raise OrdenDeFotosInvalido(
            "La lista de fotos no coincide con la galería actual. Vuelve a "
            "cargar la página e inténtalo de nuevo."
        )

    fotos = {foto.id: foto for foto in negocio.fotos.all()}
    for posicion, foto_id in enumerate(ids):
        fotos[foto_id].orden = posicion
    FotoNegocio.objects.bulk_update(fotos.values(), ["orden"])
    return negocio.fotos.all()
