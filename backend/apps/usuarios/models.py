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


class MiembroNegocio(TenantScopedModel):
    """Vínculo entre un Usuario y un Negocio, con sus capacidades.

    Reemplaza un enum fijo de roles (dueño/empleado/recepcionista): cada
    miembro tiene una combinación granular de capacidades booleanas. El
    dueño que registra el negocio recibe todas en True; los empleados
    que se agreguen después reciben solo las que se les asignen.
    """

    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="membresias"
    )
    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="miembros"
    )

    especialidad = models.CharField(max_length=150, blank=True)

    puede_cobrar = models.BooleanField(default=False)
    puede_ver_reportes = models.BooleanField(default=False)
    puede_editar_precios = models.BooleanField(default=False)
    puede_gestionar_empleados = models.BooleanField(default=False)
    puede_gestionar_agenda = models.BooleanField(default=False)

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
