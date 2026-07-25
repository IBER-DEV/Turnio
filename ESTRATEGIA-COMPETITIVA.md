# Estrategia competitiva — Turnio vs. Goldie (y el competidor real)

> Documento de producto, no de implementación. Vive en la raíz porque
> concierne a ambas partes (prioriza qué construir en Fase 3+, y varias
> decisiones de UX que afectan al frontend ya en Fase 1-2). Se actualiza
> agregando, no borrando — si una hipótesis de aquí se refuta después
> con evidencia nueva, se anota el cambio, no se reescribe la conclusión
> vieja.
>
> Origen: auditoría pedida por el humano (2026-07-25) para encontrar
> dónde competir contra Goldie sin construir un clon, dado que Turnio lo
> construye una sola persona en paralelo con otra en frontend.

## Limitaciones de esta investigación (léelas antes de confiar en las conclusiones)

1. **Reddit no fue accesible** para el research (bloqueado para el
   crawler). La evidencia de reseñas viene de Capterra/G2/GetApp y
   blogs — sólida en volumen, sesgada hacia usuarios anglosajones.
2. **No hay evidencia de voz de usuario colombiano en volumen.** Todo lo
   específico de LatAm que se verificó es de *mercado* (pagos,
   conectividad, regulación), no de *opinión de barberos/dueños reales*.
   Es la laguna más importante de este documento.
3. Algunas fuentes "comparativas" son contenido de marketing de un
   competidor sobre otro (ej. análisis de Booksy escrito por AgendaPro)
   — se usaron solo por sus datos verificables (precios, planes), nunca
   como opinión independiente.

**Acción pendiente para cerrar la laguna #2, más barata que cualquier
research adicional:** visitar 10 barberías locales y preguntar solo (a)
cómo agendan hoy, (b) cómo le pagan al barbero a fin de semana, (c) qué
pasa cuando se cae el internet. Sin esto, todo lo de abajo es hipótesis
de mercado, no de usuario.

## Fase 1 — Qué es Goldie realmente

Goldie (antes Appointfix) se autodefine textualmente como *"built for
solopreneurs"*. ~150.000 profesionales, 4.8/5 en Capterra (1.169
reseñas).

| Plan | Precio | Usuarios |
|---|---|---|
| Starter | Gratis | 1 usuario, 20 citas/mes |
| Pro | $19.99/mes | 1 usuario |
| Pro Plus | $39.99/mes | Múltiples calendarios/staff |

**Dato central:** en Goldie, agregar un segundo empleado obliga a subir
al plan del doble de precio. El multi-empleado es su *upsell*, no su
diseño — es una agenda personal de profesional independiente a la que
después le pegaron soporte de equipo.

### Qué hace excepcionalmente bien (no competir aquí)
- Onboarding: "empieza a agendar en minutos" es real y su fortaleza más
  citada.
- Recordatorios automáticos (razón #1 de satisfacción).
- Auto-reserva del cliente sin ida y vuelta.
- Web de reservas incluida gratis.
- UI limpia y consistente.

### Qué es innecesariamente complejo o está roto (patrones repetidos en reseñas)
- Créditos SMS confusos: límites, conteo poco claro, fallas de entrega.
- Tier gratis muy limitado / salto de precio a premium (4+ menciones).
- Solo móvil, sin escritorio decente (3 menciones).
- Glitches y lentitud (3+ menciones).
- Multi-staff y calendario compartido limitados (2 menciones) — cita
  textual de un usuario: *"ability to share a calendar with another
  practitioner"* como feature faltante.
- Suscripciones legacy (ex-Appointfix) sin soporte técnico.

### ⛔ Qué NO construir el primer año, aunque Goldie (o AgendaPro/Booksy) lo tengan
Todo esto es superficie de mantenimiento permanente con ROI bajo para
una persona sola:

| No construir | Por qué |
|---|---|
| Campañas de marketing / email blasts | Módulo que más soporte genera y menos se usa; es un producto aparte. |
| Gift cards | Uso casi nulo en barberías de barrio en LatAm. |
| Inventario avanzado | Un negocio que ya necesita esto no es el cliente objetivo de Fase 1-3. |
| AI Receptionist | Costo por token + alucinaciones + soporte 24/7 — inviable para 1 persona. |
| BNPL (Klarna/Afterpay) | No existe en ese formato en Colombia. |
| Constructor de sitios web propio | Mantenimiento eterno; un link de reserva basta. |
| Precios dinámicos, listas de espera avanzadas | Complejidad sin demanda validada todavía. |
| Ser procesador de pagos propio | Ver Fase 3 — es la trampa más peligrosa de la lista. |
| Marketplace de descubrimiento | Requiere liquidez de dos lados; imposible de arrancar solo. Ya es Fase 6+ en `CLAUDE.md`. |
| Facturación electrónica DIAN propia | Requiere habilitación como proveedor tecnológico ante la DIAN, multas hasta 15.000 UVT por mal manejo. Se integra un tercero autorizado, jamás se construye desde cero. |

## Fase 2 — Validación de hipótesis con evidencia

### El reencuadre más importante de todo el documento
**Goldie no es el competidor real en Colombia.** Es un producto US/UK
para *solopreneurs*. El competidor real es **AgendaPro** (chileno, se
autodenomina #1 en LatAm) y, en segundo lugar, **Booksy**. AgendaPro ya
tiene WhatsApp, comisiones automáticas, control de ingresos/egresos y
POS. Medir a Turnio solo contra Goldie hace que se construyan features
que AgendaPro ya resolvió, sin mirar al rival que sí compite por el
mismo cliente.

Grietas verificadas de AgendaPro (reseñas):
- *"el sistema de pagos es difícil para quienes no viven en Chile"*
- *"el método de cobro es ineficaz y prefieren hacer pagos fuera del sistema"*
- Aumento periódico de tarifas (queja recurrente)
- *"constantemente están cambiando la estética y funcionalidades"*
- Planes intermedios de $40–80 USD/mes para un negocio independiente

Booksy: 34,99€/mes un barbero, 50,99€/mes tres sillas. Quejas: soporte,
bugs, retrasos en pagos, personalización limitada.

### Veredicto por hipótesis

| # | Hipótesis original | Veredicto | Evidencia clave |
|---|---|---|---|
| 1 | Goldie es para independientes, no para administrar un negocio | ✅ Confirmada | Se autodefine "built for solopreneurs"; multi-staff detrás del plan más caro. |
| 2 | LatAm depende más de WhatsApp | ✅ Confirmada, con trampa de costos | AgendaPro lo vende como diferenciador. Pero desde 2025 Meta cobra por mensaje; plantillas *utility* se cobran desde el mensaje 1 (solo lo iniciado por el cliente es gratis, 1.000/mes). Requiere verificación Meta Business. |
| 3 | Muchos negocios tienen un solo operador | ❌ **No soportada** | Ver sección dedicada abajo — es la hipótesis más peligrosa del brief original. |
| 4 | El onboarding pide demasiada configuración | ⚠️ Parcial | Cierto para AgendaPro/Booksy (POS, inventario, impuestos). Falso para Goldie, cuyo onboarding rápido es su fortaleza más elogiada — no se le puede ganar ahí, sí a AgendaPro. |
| 5 | Simplicidad > más features | ✅ Confirmada | Patrón de churn documentado: pagar por features que nunca se usan; apilamiento de costos (tier + cargo por empleado + markup de procesamiento + créditos SMS + comisión). |
| 6 | Caja/comisiones/cierre > marketing | ✅ Confirmada | Modelo colombiano verificado: comisión dueño 30% / barbero 70%. Es cálculo real de nómina, no un reporte accesorio. |
| 7 | Integraciones locales son ventaja | ✅ Confirmada, y subestimada en el brief original | Ver Bre-B abajo — es más grande de lo planteado inicialmente. |
| 8 | Offline es diferenciador | ✅ Confirmada, con matiz | DANE: solo 44,2% de las microempresas colombianas accedían a internet en 2023. Ver matiz de alcance en Fase 3. |

### Por qué la hipótesis #3 (operador único por defecto) se descarta

El brief original pedía "operador único por defecto (el dueño no
necesita crearse como empleado)". Esto **contradice una decisión de
arquitectura ya tomada** en `CLAUDE.md` y en `ROADMAP.md` ("Agenda por
empleado desde el inicio (Fase 1), no operador único como caso
central"). La evidencia de esta auditoría respalda la decisión ya
tomada, no el brief:

- El modelo colombiano documentado es comisión 70/30 entre dueño y
  barbero — presupone varios barberos.
- El alquiler de silla a barberos independientes es un modelo
  estructural del sector, no una excepción.
- La debilidad más citada de Goldie **es justamente** su manejo débil
  de multi-empleado.
- Copiar el "operador único" de Goldie sería heredar su punto débil y
  renunciar al único punto ciego que tiene frente a Turnio.

**Decisión: no se cambia la arquitectura.** El backend de Fase 1 ya
está construido con agenda y disponibilidad por empleado desde el
inicio; se mantiene así.

## Fase 3 — Diferenciación de Turnio

### El insight central: no ser procesador de pagos, sino conciliador

El 76% de los pagos móviles en comercios colombianos se hace por QR.
**Bre-B** (sistema de pagos inmediatos del Banco de la República, tipo
"Pix colombiano") acumuló en sus primeros 6 meses: 99 millones de
llaves, 33,9M de clientes, 2,9 millones de comercios, moviendo $105
billones. Transferencias en <20 segundos, QR interoperable que
cualquier billetera escanea, gratis para personas hasta 2028, y
accesible a empresas no financieras vía PSP (Wompi/Bold) con webhook de
confirmación.

Es decir: **el dinero ya se mueve bien en Colombia sin Turnio.** La
barbería ya tiene el QR de Nequi pegado al espejo.

De ahí la decisión de producto:

> ❌ No ser procesador de pagos propio. Eso trae PCI, disputas,
> contracargos, retención de fondos, licencias — exactamente donde
> Booksy y AgendaPro fallan ("retrasos en pagos", "prefieren pagar fuera
> del sistema").
>
> ✅ Ser el sistema que **concilia** el dinero que ya se movió. Cero
> riesgo regulatorio, cero comisión que cobrarle al negocio, y resuelve
> el dolor real: saber cuánto entró y cuánto le toca a cada barbero.

Esto es lo que ningún competidor internacional puede replicar rápido, y
lo que AgendaPro hace mal por no ser local.

### Las 10 oportunidades priorizadas

Orden por impacto × factibilidad para una persona sola. **Empezar por
1–7**; las últimas tres dependen de terceros externos (Meta, PSPs) que
bloquean por semanas y no deben ser lo primero.

| # | Oportunidad | Por qué gana | Esfuerzo | Dependencia externa |
|---|---|---|---|---|
| 1 | Multi-empleado en el plan gratis/base | Ataca directo el paywall de $39.99 de Goldie y el cargo por silla de Booksy. Ya construido en el backend. | Bajo | Ninguna |
| 2 | Precio fijo en COP, sin escalera por empleado | Ataca a la vez: subidas de tarifa de AgendaPro, per-silla de Booksy, tier gate de Goldie. | Bajo | Ninguna |
| 3 | Registrar pago recibido (Nequi/Daviplata/efectivo/Bre-B) sin procesarlo | El 76% QR ya existe; solo hace falta registrarlo. Cero regulación de pagos. | Bajo | Ninguna |
| 4 | Cierre de caja diario en segundos | Crea el hábito de abrir la app aunque no haya citas nuevas. | Medio | Ninguna |
| 5 | Comisiones 70/30 automáticas por barbero | Modelo colombiano verificado; convierte el Excel dominical en un botón. | Medio | Ninguna |
| 6 | Cola de escritura local-first (offline) | 44,2% de microempresas con internet (DANE); que nunca se pierda un cobro por caída de conexión. | Medio | Ninguna |
| 7 | Link de reserva por WhatsApp (click-to-chat, sin API) | 80% del valor de "WhatsApp" al 0% del costo/complejidad de la API oficial de Meta. | Bajo | Ninguna |
| 8 | Recordatorio WhatsApp vía plantilla utility (API oficial) | Colombia es mercado barato para Meta, pero se cobra desde el mensaje 1 — cotizar antes de comprometerse. | Alto | Meta Business/BSP |
| 9 | QR Bre-B dinámico por cita, con confirmación automática | Nadie internacional lo tiene; requiere integrarse vía un PSP (Wompi/Bold), no directo con Banrep. | Alto | PSP externo |
| 10 | Abono/depósito para reducir no-shows | No-show ~30% del sector; depósitos lo reducen 29–70% (evidencia internacional). **Validar culturalmente primero** — pedir abono puede no ser aceptado en negocios de barrio. | Alto | Validación cultural + cobro |

### Decisiones de UX que son ventaja competitiva

1. Cero configuración obligatoria: servicios precargados y editables
   (ej. "Corte $25.000, Barba $15.000, Corte+Barba $35.000"); debe
   poderse agendar antes de configurar nada.
2. La app abre en "qué tengo hoy", no en un dashboard de métricas.
3. Cobrar y agendar deben ser el mismo gesto, no módulos separados —
   ahí está la ventaja de velocidad frente a todos los competidores
   auditados.
4. Nunca un error rojo sin acción de recuperación (ya implementado en
   el rediseño de Fase 1 del frontend — mantener el patrón).
5. Precios en pesos sin decimales (`$25.000`, no `$25,000.00`) — señal
   de "esto es de aquí".
6. Todo debe operarse con una mano, de pie, con tijeras en la otra
   (objetivo táctil mínimo de 44px, ya adoptado en el sistema de diseño
   del frontend).

## Los 15 minutos: qué debe vivir un usuario que hoy usa Goldie

1. **Minuto 0–2 — "Ya está funcionando."** Registra el negocio y ve su
   agenda de hoy con servicios precargados, cero pantallas de
   configuración. (Aquí solo hay que empatar con Goldie, no ganarle —
   es su fortaleza real.)
2. **Minuto 2–5 — "Agregué a mis 3 barberos y no me cobró."** El golpe
   directo: en Goldie eso duplica el precio; en Booksy es cargo por
   silla. Es el momento en que Turnio deja de parecer "otro Goldie".
3. **Minuto 5–10 — "Cobré como cobro de verdad."** Registra una cita
   completada, marca que le pagaron por Nequi. Sin datáfono, sin
   comisión, sin esperar payout.
4. **Minuto 10–15 — "Sé cuánto le debo a Jimmy."** Cierra el día y ve
   entrada total + comisión 70/30 calculada. Es el momento de
   conversión: el problema que hoy resuelve con Excel el domingo, y que
   ni Goldie ni Booksy resuelven.

## Decisiones tomadas a partir de esta auditoría (2026-07-25)

1. **No se cambia la arquitectura multi-empleado.** Se mantiene
   agenda/capacidades por empleado desde el inicio, tal como ya estaba
   en `CLAUDE.md` y `ROADMAP.md`. El brief que motivó esta auditoría
   pedía operador único por defecto; la evidencia lo contradice.
2. **El benchmark de producto pasa a ser AgendaPro** (competidor
   regional real), con Goldie como referencia secundaria de UX/onboarding
   y Booksy como referencia de pricing.
3. **Turnio no será procesador de pagos propio.** El rol de Fase 3 es
   *conciliar* pagos ya realizados por fuera (Nequi/Daviplata/efectivo/
   Bre-B), no cobrar comisión por procesarlos.
4. **Pendiente antes de comprometer Fase 3 en detalle:** validar con
   10 negocios locales (ver limitaciones al inicio de este documento).
