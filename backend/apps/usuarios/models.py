from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models

from apps.common.models import TenantScopedModel


class UsuarioManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("El usuario debe tener un email")
        email = self.normalize_email(email)
        usuario = self.model(email=email, **extra_fields)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """Usuario global de la plataforma.

    No pertenece directamente a un tenant: un mismo email puede en el
    futuro ser cliente de un negocio y dueño/empleado de otro. El
    vínculo con un negocio concreto y sus capacidades vive en
    MiembroNegocio.
    """

    email = models.EmailField(unique=True)
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]

    def __str__(self):
        return self.email


#: Las capacidades del sistema, en un solo lugar. Agregar una es agregarla
#: acá y como campo de `Cargo`; el resto (serializers, tests de deriva,
#: catálogo del frontend) se cuelga de esta lista.
CAPACIDADES = (
    "puede_cobrar",
    "puede_ver_reportes",
    "puede_editar_precios",
    "puede_gestionar_empleados",
    "puede_gestionar_agenda",
    "puede_configurar_horarios",
    "puede_ver_agenda_completa",
    "puede_editar_negocio",
)


class Cargo(TenantScopedModel):
    """Un cargo del negocio: un nombre y lo que esa gente puede hacer.

    **Cada negocio define los suyos.** No hay un catálogo global de roles
    ni un enum cerrado en el código: al registrar un negocio se siembran
    tres cargos de arranque y a partir de ahí el dueño los renombra, los
    edita, crea otros o borra los que no usa.

    El cargo es la **única fuente de verdad** de las capacidades: un
    `MiembroNegocio` no tiene permisos propios, tiene un cargo. Se
    descartó permitir excepciones por persona (decisión del humano,
    2026-07-26) porque dos fuentes obligan a resolver qué pasa al editar
    un cargo que alguien ya tenía modificado, y esa pregunta no tiene
    respuesta buena. Si una persona necesita algo distinto, se le crea un
    cargo.
    """

    class Tipo(models.TextChoices):
        """Discriminador de dominio: qué **experiencia** de la app recibe.

        Lo usa el frontend para decidir qué shell montar sin encadenar
        condicionales por capacidad (ver `CONTRATO.md` sección 5.10).

        Ojo: es una decisión de **navegación, no de seguridad**. El
        backend nunca filtra datos por `tipo` — sigue exigiendo la
        capacidad concreta en cada endpoint. Si el tipo fuera la barrera,
        bastaría pedir otra ruta para saltársela.
        """

        ADMINISTRACION = "administracion", "Administración"
        RECEPCION = "recepcion", "Recepción"
        OPERATIVO = "operativo", "Operativo"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="cargos"
    )
    nombre = models.CharField(max_length=80)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.OPERATIVO)

    puede_cobrar = models.BooleanField(default=False)
    puede_ver_reportes = models.BooleanField(default=False)
    puede_editar_precios = models.BooleanField(default=False)
    puede_gestionar_empleados = models.BooleanField(default=False)

    # Operar la agenda del día: crear, mover y borrar citas de cualquiera.
    # No incluye decidir el horario — un recepcionista agenda, pero no
    # define a qué hora abre el local.
    puede_gestionar_agenda = models.BooleanField(default=False)
    # Definir cuándo se trabaja: horario del negocio y horario propio de
    # los empleados.
    puede_configurar_horarios = models.BooleanField(default=False)
    # Ver las citas de todo el negocio. Sin esta capacidad, un miembro
    # solo ve las suyas: las citas traen nombre y teléfono del cliente, o
    # sea la libreta de clientes del negocio.
    puede_ver_agenda_completa = models.BooleanField(default=False)
    # Editar la identidad pública del negocio: nombre, dirección,
    # teléfono, logo y fotos del perfil (`turnio.app/{slug}`). Deliberadamente
    # separada de `puede_gestionar_empleados`: quien administra el equipo
    # no necesariamente decide cómo se ve el negocio hacia afuera.
    puede_editar_negocio = models.BooleanField(default=False)

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["negocio", "nombre"], name="unico_cargo_por_negocio"
            )
        ]

    def __str__(self):
        return f"{self.nombre} @ {self.negocio.nombre}"

    def capacidades(self):
        """Las capacidades de este cargo como dict, para comparar y copiar."""
        return {campo: getattr(self, campo) for campo in CAPACIDADES}


class MiembroNegocio(TenantScopedModel):
    """Vínculo entre un Usuario y un Negocio, a través de un `Cargo`.

    No guarda capacidades propias: lo que puede hacer sale de su cargo
    (ver `Cargo`). `cargo` es nullable solo para que la migración desde
    el modelo anterior —donde las capacidades vivían acá— pudiera correr
    en dos pasos; en la práctica toda membresía tiene uno.
    """

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="membresias"
    )
    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="miembros"
    )
    cargo = models.ForeignKey(
        Cargo, on_delete=models.PROTECT, related_name="miembros", null=True, blank=True
    )

    especialidad = models.CharField(max_length=150, blank=True)

    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "negocio"], name="unico_miembro_por_negocio"
            )
        ]

    def __str__(self):
        return f"{self.usuario.email} @ {self.negocio.nombre}"

    def tiene(self, capacidad):
        """Si su cargo le concede `capacidad`.

        Único camino para preguntar por un permiso. Antes se leía
        `membresia.puede_x` directo; ahora las capacidades viven en el
        cargo y esto evita que cada llamador tenga que acordarse de
        atravesarlo (y de que el cargo puede ser nulo).
        """
        return bool(self.cargo and getattr(self.cargo, capacidad, False))

    @property
    def tipo(self):
        """El discriminador de dominio de su cargo, para el frontend."""
        return self.cargo.tipo if self.cargo else Cargo.Tipo.OPERATIVO
