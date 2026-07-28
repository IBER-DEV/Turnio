from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.usuarios.models import Cargo, MiembroNegocio, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["email"]
    list_display = ["email", "nombre", "is_active", "is_staff"]
    search_fields = ["email", "nombre"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("nombre", "telefono")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "nombre", "password1", "password2")}),
    )


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "negocio", "tipo"]
    list_filter = ["tipo", "negocio"]
    search_fields = ["nombre", "negocio__nombre"]


@admin.register(MiembroNegocio)
class MiembroNegocioAdmin(admin.ModelAdmin):
    list_display = ["usuario", "negocio", "cargo", "activo"]
    list_filter = ["activo", "negocio", "cargo__tipo"]
    search_fields = ["usuario__email", "negocio__nombre"]
