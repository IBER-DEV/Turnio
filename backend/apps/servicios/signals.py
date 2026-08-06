import django.dispatch

#: Se envía cuando `apps.servicios.services.aprobar_registro` confirma un
#: `RegistroServicio`. `sender=RegistroServicio`, kwarg `registro`.
#:
#: Sin receptores conectados a propósito. Cuando llegó Fase 3 (Caja), el
#: cálculo de comisión terminó resolviéndose con un import directo desde
#: `apps.caja.services.registrar_movimiento` en vez de un receptor acá —
#: es un solo efecto síncrono, y `backend/CLAUDE.md` reserva las señales
#: para cuando un mismo hecho de negocio necesita disparar **varios**
#: efectos desacoplados. Se deja como punto de extensión para ese caso
#: futuro (ej. una notificación al aprobar), no para el cálculo de
#: comisión.
servicio_aprobado = django.dispatch.Signal()
