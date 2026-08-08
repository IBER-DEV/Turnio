from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TenantScopedModel

#: Métodos con los que puede entrar (o salir) plata. Turnio **no procesa
#: pagos**: esto es solo la etiqueta de conciliación — la transferencia ya
#: se movió por fuera, acá se anota que pasó. No hay integración con
#: ninguna pasarela.
#:
#: Vive suelto y no dentro de `MovimientoCaja` porque lo usan también
#: `Pago` y `Devolucion`, que son los que de verdad lo originan.


class MetodoPago(models.TextChoices):
    EFECTIVO = "efectivo", "Efectivo"
    TARJETA = "tarjeta", "Tarjeta"
    NEQUI = "nequi", "Nequi"
    DAVIPLATA = "daviplata", "Daviplata"
    BRE_B = "bre_b", "Bre-B"
    OTRO = "otro", "Otro"


#: El único método que pasa por el cajón físico y por lo tanto entra al
#: arqueo. Todo lo demás se concilia contra el extracto de su plataforma,
#: no contra lo que hay en el cajón (ver `apps.caja.services.arqueo_de`).
METODOS_EN_EFECTIVO = {MetodoPago.EFECTIVO}


class Caja(TenantScopedModel):
    """La jornada de caja de un negocio: se abre, recibe movimientos, se
    cierra con arqueo.

    Máquina de estados simple (`abierta → cerrada`, sin librería, mismo
    patrón que `apps.agenda.services.TRANSICIONES_VALIDAS` para `Cita`).
    Solo puede haber **una caja abierta por negocio a la vez** — la
    constraint de abajo es la garantía real ante dos personas abriendo
    caja casi al mismo tiempo; la capa de servicios valida primero para
    devolver un error de negocio legible en vez de un `IntegrityError`
    crudo (ver `apps.caja.services.abrir_caja`).

    Los tres campos de arqueo (`efectivo_esperado`, `efectivo_contado`,
    `diferencia`) son la excepción a la regla de "los totales se calculan
    en caliente, nunca se persisten": acá sí se congelan al cerrar. Un
    arqueo es una afirmación sobre un instante —"a las 8pm conté esto y
    faltaban $2.000"— y recalcularlo después contra los movimientos de
    hoy lo volvería una cifra viva que cambia sola, que es justo lo
    contrario de lo que un arqueo significa.
    """

    class Estado(models.TextChoices):
        ABIERTA = "abierta", "Abierta"
        CERRADA = "cerrada", "Cerrada"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="cajas"
    )
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ABIERTA)
    saldo_inicial = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Efectivo con el que arranca el cajón (la base).",
    )
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

    # Congelados al cerrar. Null mientras la caja está abierta.
    efectivo_esperado = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=(
            "saldo_inicial + ingresos en efectivo − egresos en efectivo − "
            "devoluciones en efectivo, al momento del cierre."
        ),
    )
    efectivo_contado = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Lo que la persona contó de verdad en el cajón.",
    )
    diferencia = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="efectivo_contado − efectivo_esperado. Negativo es faltante.",
    )

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
    """Cada vez que entra o sale plata del negocio. El libro contable.

    **Inmutable tras crearse** — sin `PUT`/`PATCH`/`DELETE` en su vista y
    sin ninguna función de servicio que lo modifique. Un cobro mal hecho
    no se edita ni se borra: se corrige con una **devolución**, que es
    otro movimiento, de signo contrario, que apunta a la misma venta (ver
    `apps.caja.services.devolver`). El historial financiero no se altera
    retroactivamente nunca — es lo que hace que la auditoría y el arqueo
    de ayer sigan queriendo decir algo mañana.

    Los tres tipos y su efecto sobre el efectivo del cajón:

    - `ingreso` — suma. Siempre nace de un `Pago` sobre una `Venta`.
    - `egreso` — resta. Gasto operativo del negocio (insumos, arriendo,
      domicilio). No tiene venta asociada, por diseño.
    - `devolucion` — resta. Plata que se le devuelve a un cliente. Tipo
      propio y no un `egreso` a propósito: para el dueño "devolví $35.000
      de un corte" y "compré shampoo por $80.000" son hechos distintos, y
      mezclarlos haría que el reporte de gastos mienta. La fórmula del
      arqueo los suma por separado justamente por eso.

    `venta` está solo para trazabilidad y para poder listar el movimiento
    junto a lo que lo originó; la relación fuerte vive del otro lado
    (`Pago.movimiento` / `Devolucion.movimiento`, ambos `OneToOne`), que
    es la que garantiza que no haya dos movimientos para el mismo pago.
    """

    class Tipo(models.TextChoices):
        INGRESO = "ingreso", "Ingreso"
        EGRESO = "egreso", "Egreso"
        DEVOLUCION = "devolucion", "Devolución"

    class CategoriaEgreso(models.TextChoices):
        INSUMOS = "insumos", "Insumos"
        SERVICIOS_PUBLICOS = "servicios_publicos", "Servicios públicos"
        ARRIENDO = "arriendo", "Arriendo"
        TRANSPORTE = "transporte", "Transporte"
        MANTENIMIENTO = "mantenimiento", "Mantenimiento"
        NOMINA = "nomina", "Nómina"
        COMISIONES = "comisiones", "Comisiones"
        OTROS = "otros", "Otros"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="movimientos_caja"
    )
    caja = models.ForeignKey(Caja, on_delete=models.PROTECT, related_name="movimientos")
    registrado_por = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="movimientos_registrados"
    )
    tipo = models.CharField(max_length=12, choices=Tipo.choices)
    metodo_pago = models.CharField(max_length=12, choices=MetodoPago.choices)
    monto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Siempre positivo. El signo lo da `tipo`, no el monto.",
    )
    concepto = models.CharField(max_length=200)
    # Solo tiene contenido en los egresos (validado en el serializer: el
    # modelo describe la forma del dato, no la regla de negocio).
    categoria = models.CharField(
        max_length=20, choices=CategoriaEgreso.choices, blank=True
    )
    venta = models.ForeignKey(
        "caja.Venta",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.tipo} {self.monto} — {self.concepto}"

    @property
    def es_efectivo(self):
        return self.metodo_pago in METODOS_EN_EFECTIVO


def ruta_evidencia(instancia, nombre_archivo):
    """`ventas/<negocio_id>/evidencias/<aleatorio><.ext>`.

    Mismo criterio que `apps.negocios.models.ruta_foto`: nombre aleatorio
    y no el original, que viene del dispositivo de quien sube la foto y no
    debería escribirse tal cual en disco.
    """
    extension = Path(nombre_archivo).suffix.lower()
    return f"ventas/{instancia.negocio_id}/evidencias/{uuid4().hex}{extension}"


#: Peso máximo de la evidencia fotográfica. Mismo límite que las imágenes
#: del negocio (`apps.negocios.models.PESO_MAXIMO_IMAGEN_BYTES`).
PESO_MAXIMO_EVIDENCIA_BYTES = 5 * 1024 * 1024


class Venta(TenantScopedModel):
    """Lo que un cliente debe por el trabajo que se le hizo.

    Es el corazón del rediseño del módulo de dinero: **el servicio genera
    una deuda, el pago genera el movimiento de dinero**. Son dos hechos
    separados y por eso son dos tablas. Reemplaza al viejo
    `servicios.RegistroServicio`, que mezclaba "esto se hizo" con un
    circuito de aprobación redundante — cobrar ya es aprobar: nadie le
    cobra a un cliente por un trabajo que cree inventado.

    Nace de dos lados, y en los dos termina en la misma cola de cobro:

    - desde una `Cita` que el empleado marca como completada
      (`apps.agenda.services.completar_cita`), o
    - suelta, para el cliente que llegó sin cita (walk-in).

    `total` se persiste porque es la suma de precios **congelados** en los
    items: si mañana sube el precio del corte, la venta de ayer no puede
    cambiar. No es un total "vivo" derivable del catálogo — es el
    histórico de cuánto se cobró.

    No tiene campo `empleado`. Quién hizo el trabajo es de cada
    `VentaItem`, que es donde vive también su `porcentaje_comision`: una
    cuenta puede pasar por dos manos (el que corta y el que hace la
    barba), y un "responsable principal" derivable de los items sería una
    segunda verdad que se puede desincronizar.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente de cobro"
        PARCIAL = "parcial", "Pagada parcialmente"
        PAGADA = "pagada", "Pagada"
        ANULADA = "anulada", "Anulada"

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="ventas"
    )
    # `OneToOne` y no `ForeignKey`: es la garantía a nivel de base de que
    # una cita no puede generar dos ventas. `completar_cita` es
    # idempotente y valida antes para dar un error legible, pero ante dos
    # requests simultáneos del mismo empleado tocando "Completar" dos
    # veces, esta constraint es lo único que de verdad lo impide.
    cita = models.OneToOneField(
        "agenda.Cita",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="venta",
    )
    nombre_cliente = models.CharField(max_length=150)
    telefono_cliente = models.CharField(max_length=30, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    estado = models.CharField(
        max_length=12, choices=Estado.choices, default=Estado.PENDIENTE
    )
    observaciones = models.TextField(blank=True)
    # Sin `null=True`: mismo criterio que `Negocio.logo` — "sin evidencia"
    # es la cadena vacía, no NULL.
    evidencia = models.ImageField(upload_to=ruta_evidencia, blank=True)

    creada_por = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="ventas_creadas"
    )
    anulada_por = models.ForeignKey(
        "usuarios.MiembroNegocio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ventas_anuladas",
    )
    anulada_en = models.DateTimeField(null=True, blank=True)
    motivo_anulacion = models.TextField(blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Venta #{self.pk} — {self.nombre_cliente} ({self.estado})"

    @property
    def total_pagado(self):
        """Lo efectivamente cobrado, neto de devoluciones.

        Calculado en caliente y no persistido: a diferencia de `total`
        (que congela precios históricos), esto es la suma de hechos que ya
        están cada uno en su propia fila. Guardarlo sería un tercer lugar
        donde la misma verdad puede quedar mal.
        """
        pagado = sum((pago.monto for pago in self.pagos.all()), Decimal("0"))
        devuelto = sum((dev.monto for dev in self.devoluciones.all()), Decimal("0"))
        return pagado - devuelto

    @property
    def saldo_pendiente(self):
        return self.total - self.total_pagado


class VentaItem(TenantScopedModel):
    """Una línea de una venta: un servicio prestado o algo suelto vendido.

    Todo lo que importa está **copiado**, no referenciado: `descripcion`,
    `precio_unitario` y `porcentaje_comision` se congelan al crear la
    línea. `servicio` queda como puntero para reportes ("cuánto se vendió
    de corte este mes"), pero ningún cálculo de dinero lo lee — si el
    dueño sube el precio o cambia la comisión, las ventas ya hechas no se
    mueven.

    `servicio` es nullable a propósito: deja representar la venta de un
    producto (shampoo, cera) escribiendo descripción y precio a mano,
    sin necesitar todavía un catálogo de `Producto`. Cuando ese catálogo
    exista, entra como un segundo FK nullable al lado de este, sin tocar
    nada del circuito de dinero.

    `empleado` es obligatorio y es la **fuente de verdad de la comisión**
    junto con `porcentaje_comision` (regla de implementación fijada por el
    humano, 2026-08-07).
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="items_venta"
    )
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="items")
    servicio = models.ForeignKey(
        "servicios.Servicio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="items_venta",
    )
    empleado = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="items_venta"
    )

    descripcion = models.CharField(max_length=200)
    precio_unitario = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    cantidad = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    porcentaje_comision = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0")
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.cantidad}× {self.descripcion} — {self.subtotal}"

    @property
    def subtotal(self):
        return self.precio_unitario * self.cantidad


class Pago(TenantScopedModel):
    """Plata que entra contra una venta. Una venta admite varios.

    Existe como tabla propia —y no como un campo `metodo_pago` en la
    venta— para que el pago mixto y el pago parcial sean el caso normal y
    no una excepción: `$40.000` en efectivo y `$60.000` por transferencia
    son dos filas de la misma venta. Retrofitear esto después habría
    obligado a reescribir todo lo que lee dinero.

    Cada pago crea **exactamente un** `MovimientoCaja` de tipo `ingreso`,
    en la misma transacción (`apps.caja.services.registrar_pago`). El
    `OneToOne` es la garantía de que no se pueda duplicar.
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="pagos"
    )
    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name="pagos")
    movimiento = models.OneToOneField(
        MovimientoCaja, on_delete=models.PROTECT, related_name="pago"
    )
    monto = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    metodo_pago = models.CharField(max_length=12, choices=MetodoPago.choices)
    registrado_por = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="pagos_registrados"
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["creado_en"]

    def __str__(self):
        return f"Pago {self.monto} ({self.metodo_pago}) — venta #{self.venta_id}"


class Devolucion(TenantScopedModel):
    """Plata que se le devuelve al cliente sobre una venta ya cobrada.

    Es el **único** mecanismo para corregir dinero ya registrado: nunca se
    edita ni se borra un `MovimientoCaja` (regla de implementación fijada
    por el humano, 2026-08-07). Devolver crea un movimiento nuevo de tipo
    `devolucion`, y tanto el cobro original como la devolución quedan en
    el historial y en la auditoría.

    El dominio queda listo aunque la UI de devoluciones llegue después:
    `anular_venta` sobre una venta ya cobrada la usa internamente.
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="devoluciones"
    )
    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name="devoluciones")
    movimiento = models.OneToOneField(
        MovimientoCaja, on_delete=models.PROTECT, related_name="devolucion"
    )
    monto = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    metodo_pago = models.CharField(max_length=12, choices=MetodoPago.choices)
    motivo = models.TextField()
    registrado_por = models.ForeignKey(
        "usuarios.MiembroNegocio",
        on_delete=models.PROTECT,
        related_name="devoluciones_registradas",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["creado_en"]

    def __str__(self):
        return f"Devolución {self.monto} — venta #{self.venta_id}"


class ComisionDevengada(TenantScopedModel):
    """Lo que un empleado se ganó por una línea de venta, ya cobrada.

    Se crea **una sola vez**, cuando la venta llega a `pagada` — no en
    cada pago. Antes la comisión se calculaba sobre el monto del
    movimiento de caja, lo que con pagos parciales o mixtos generaba una
    comisión por cada pago (o una comisión partida al azar según cómo
    pagara el cliente). La comisión es de la **venta**, no del pago.

    `OneToOne` con el item: es la garantía de que un mismo trabajo no
    devengue comisión dos veces, aunque algo llame al cálculo de nuevo.

    Si la venta se anula o se devuelve completa, la comisión se revierte
    borrando esta fila (nunca es dinero ya entregado: el movimiento de
    caja de la anulación sí queda en el histórico, ver `Devolucion`).
    """

    negocio = models.ForeignKey(
        "negocios.Negocio", on_delete=models.CASCADE, related_name="comisiones"
    )
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="comisiones")
    item = models.OneToOneField(VentaItem, on_delete=models.CASCADE, related_name="comision")
    empleado = models.ForeignKey(
        "usuarios.MiembroNegocio", on_delete=models.PROTECT, related_name="comisiones"
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name_plural = "comisiones devengadas"

    def __str__(self):
        return f"{self.empleado} — {self.monto} (venta #{self.venta_id})"


class RegistroAuditoria(TenantScopedModel):
    """Una fila por cada mutación sobre el dominio de dinero: quién, qué,
    cuándo (`backend/CLAUDE.md`, "Auditoría desde el MVP").

    Log DIY —una fila legible por acción de negocio— en vez de
    `django-simple-history`: la superficie de mutación de este dominio es
    chica y controlada (un puñado de funciones de servicio, movimientos
    inmutables, una sola transición de estado posible en `Caja`), así que
    un rastreador genérico campo-por-campo es más maquinaria de la que la
    necesidad pide, y una fila como `"venta.anular"` es más legible que un
    diff de campos para alguien reconstruyendo qué pasó.

    **Cuidado al extender este dominio**: esta garantía depende de que
    toda mutación futura pase por `apps.caja.services`. Un endpoint nuevo
    que haga `.save()` directo sobre estos modelos rompería la auditoría
    en silencio, sin que nada avise.
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
