import django.dispatch

#: Se envía cuando `apps.servicios.services.aprobar_registro` confirma un
#: `RegistroServicio`. `sender=RegistroServicio`, kwarg `registro`.
#:
#: Sin receptores conectados todavía: es el punto de extensión donde Fase 3
#: (Caja/Comisiones) enganchará `calcular_comision()` —ya escrita en
#: `services.py`, inerte— sin tener que volver a tocar el flujo de
#: aprobación. Conectar un receptor vacío ahora sería el "sistema de
#: eventos formal" que `backend/CLAUDE.md` pide evitar en el MVP.
servicio_aprobado = django.dispatch.Signal()
