from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TenantScopedModel


class Caja(TenantScopedModel):
    """La caja del día de un negocio: se abre, recibe movimientos, se cierra.

    Máquina de estados simple (`abierta → cerrada`, sin librería, mismo
    patrón que `apps.agenda.services.TRANSICIONES_VALIDAS` para `Cita`).
    Solo puede haber **una caja abierta por negocio a la vez** — la
    constraint de abajo es la garantía real ante dos personas abriendo
    caja casi al mismo tiempo; la capa de servicios valida primero para
    devolver un error de negocio legible en vez de un `IntegrityError`
    crudo (ver `apps.caja.services.abrir_caja`).
    """

    class Estado(models.TextChoices):
        ABIERTA = "abierta", "Abierta"
        CERRADA = "cerrada", "Cerrada"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="cajas"
    )
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ABIERTA)
    saldo_inicial = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    abierta_por = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="cajas_abiertas"
    )
    abierta_en = models.DateTimeField(auto_now_add=True)
    cerrada_por = models.ForeignKey(
        "usuarios.MiembroNegocio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cajas_cerradas",
    )
    cerrada_en = models.DateTimeField(null=True, blank=True)
    nota_cierre = models.TextField(blank=True)

    class Meta:
        ordering = ["-abierta_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["negocio"],
                condition=models.Q(estado="abierta"),
                name="una_caja_abierta_por_negocio",
            ),
        ]

    def __str__(self):
        return f"Caja de {self.negocio.nombre} ({self.estado}, {self.abierta_en:%Y-%m-%d})"


class MovimientoCaja(TenantScopedModel):
    """Un ingreso o egreso dentro de una caja abierta.

    **Inmutable tras crearse** — sin `PUT`/`PATCH`/`DELETE` en su vista,
    mismo criterio que `RegistroServicio`: es un libro contable, no un
    formulario. Un error se corrige con un movimiento de ajuste nuevo,
    nunca editando el histórico.

    Turnio no procesa pagos — `metodo_pago` es solo la etiqueta de
    conciliación (Nequi/Daviplata/Bre-B/efectivo ya se movieron por
    fuera); no hay integración con ninguna pasarela.

    `registro_servicio` vincula el cobro a un `RegistroServicio` ya
    aprobado: cuando existe el vínculo, `empleado_comision` y
    `monto_comision` se calculan y fijan en el momento de crear el
    movimiento (`apps.caja.services.registrar_movimiento`) y no vuelven a
    tocarse. La constraint de abajo impide cobrar el mismo trabajo dos
    veces.
    """

    class Tipo(models.TextChoices):
        INGRESO = "ingreso", "Ingreso"
        EGRESO = "egreso", "Egreso"

    class MetodoPago(models.TextChoices):
        EFECTIVO = "efectivo", "Efectivo"
        NEQUI = "nequi", "Nequi"
        DAVIPLATA = "daviplata", "Daviplata"
        BRE_B = "bre_b", "Bre-B"
        OTRO = "otro", "Otro"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="movimientos_caja"
    )
    caja = models.ForeignKey(Caja, on_delete=models.CASCADE, related_name="movimientos")
    registrado_por = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="movimientos_registrados"
    )
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    # Blank porque solo aplica a ingresos — un egreso lo deja vacío
    # (validado en el serializer, no acá: el modelo no conoce la regla de
    # negocio, solo la forma del dato).
    metodo_pago = models.CharField(max_length=10, choices=MetodoPago.choices, blank=True)
    monto = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    concepto = models.CharField(max_length=200)
    registro_servicio = models.ForeignKey(
        "servicios.RegistroServicio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos_caja",
    )
    empleado_comision = models.ForeignKey(
        "usuarios.MiembroNegocio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="comisiones",
    )
    monto_comision = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["registro_servicio"],
                condition=models.Q(registro_servicio__isnull=False),
                name="un_movimiento_por_registro_servicio",
            ),
        ]

    def __str__(self):
        return f"{self.tipo} {self.monto} — {self.concepto}"


class RegistroAuditoria(TenantScopedModel):
    """Una fila por cada mutación sobre Caja/MovimientoCaja: quién, qué,
    cuándo (`backend/CLAUDE.md`, "Auditoría desde el MVP").

    Log DIY —una fila legible por acción de negocio— en vez de
    `django-simple-history`: la superficie de mutación de este dominio es
    chica y controlada (tres funciones de servicio, movimientos
    inmutables, una sola transición de estado posible en `Caja`), así que
    un rastreador genérico de historial campo-por-campo es más maquinaria
    de la que la necesidad real pide, y una fila como `"caja.cerrar"` es
    más legible que un diff de campos para alguien reconstruyendo qué
    pasó. `backend/CLAUDE.md` sanciona ambas opciones explícitamente.

    **Cuidado al extender este dominio**: esta garantía de auditoría
    depende de que toda mutación futura pase por `apps.caja.services`. Un
    endpoint nuevo que haga `.save()` directo sobre `Caja`/`MovimientoCaja`
    rompería la auditoría en silencio, sin que nada avise.
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="auditorias_caja"
    )
    actor = models.ForeignKey(
        "usuarios.MiembroNegocio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="acciones_caja",
    )
    accion = models.CharField(max_length=50)
    detalle = models.JSONField(default=dict, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name_plural = "registros de auditoría"

    def __str__(self):
        return f"{self.accion} @ {self.negocio.nombre} ({self.creado_en:%Y-%m-%d %H:%M})"
