def obtener_membresia_activa(usuario, negocio=None):
    """Devuelve la MiembroNegocio activa del usuario.

    En el MVP un usuario de negocio pertenece a un único Negocio, así que
    basta con la primera membresía activa. Si más adelante un mismo
    usuario pertenece a varios negocios (multi-sucursal, Fase 6), se
    puede filtrar por `negocio` explícitamente.
    """
    membresias = usuario.membresias.filter(activo=True)
    if negocio is not None:
        membresias = membresias.filter(negocio=negocio)
    return membresias.select_related("negocio", "tenant").first()
