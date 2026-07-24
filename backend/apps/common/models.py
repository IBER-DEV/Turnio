from django.db import models


class TenantScopedModel(models.Model):
    """Base para todo modelo de negocio: garantiza filtrado por tenant.

    Todo modelo que cuelgue de un negocio (Servicio, Cita, Caja, etc. en
    fases posteriores) debe heredar de esta clase en lugar de repetir el
    campo `tenant` a mano, para que el filtrado automático por tenant
    (ver apps.common.permissions) funcione de forma consistente en toda
    la API.
    """

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT)

    class Meta:
        abstract = True
