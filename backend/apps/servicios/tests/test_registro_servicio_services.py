import datetime

import pytest
from django.utils import timezone

from apps.servicios import services
from apps.servicios.models import RegistroServicio

pytestmark = pytest.mark.django_db

AYER = timezone.now() - datetime.timedelta(days=1)
MANANA = timezone.now() + datetime.timedelta(days=1)


@pytest.fixture
def negocio_con_barbero(negocio_con_dueno, servicio_de_prueba, empleado_con):
    negocio, _dueno, membresia_dueno = negocio_con_dueno
    barbero, _client = empleado_con(negocio=negocio, email="barbero@test.com", nombre="Barbero")
    return negocio, membresia_dueno, barbero, servicio_de_prueba


def test_registrar_servicio_queda_pendiente(negocio_con_barbero):
    negocio, _dueno, barbero, servicio = negocio_con_barbero

    registro = services.registrar_servicio(
        negocio=negocio,
        empleado=barbero,
        servicio=servicio,
        nombre_cliente="Cliente Walk-in",
        fecha_hora=AYER,
    )

    assert registro.estado == RegistroServicio.Estado.PENDIENTE
    assert registro.empleado_id == barbero.id
    assert registro.aprobado_por is None
    assert registro.fecha_revision is None


def test_registrar_servicio_rechaza_fecha_futura(negocio_con_barbero):
    negocio, _dueno, barbero, servicio = negocio_con_barbero

    with pytest.raises(services.FechaFutura):
        services.registrar_servicio(
            negocio=negocio,
            empleado=barbero,
            servicio=servicio,
            nombre_cliente="Cliente",
            fecha_hora=MANANA,
        )


def test_aprobar_registro_deja_rastro_de_quien_y_cuando(negocio_con_barbero):
    negocio, dueno, barbero, servicio = negocio_con_barbero
    registro = services.registrar_servicio(
        negocio=negocio, empleado=barbero, servicio=servicio,
        nombre_cliente="Cliente", fecha_hora=AYER,
    )

    aprobado = services.aprobar_registro(registro=registro, revisor=dueno)

    assert aprobado.estado == RegistroServicio.Estado.APROBADO
    assert aprobado.aprobado_por_id == dueno.id
    assert aprobado.fecha_revision is not None


def test_aprobar_registro_envia_la_senal(negocio_con_barbero):
    from apps.servicios.signals import servicio_aprobado

    negocio, dueno, barbero, servicio = negocio_con_barbero
    registro = services.registrar_servicio(
        negocio=negocio, empleado=barbero, servicio=servicio,
        nombre_cliente="Cliente", fecha_hora=AYER,
    )

    recibidos = []
    def _receptor(sender, registro, **kwargs):
        recibidos.append(registro.id)
    servicio_aprobado.connect(_receptor)
    try:
        services.aprobar_registro(registro=registro, revisor=dueno)
    finally:
        servicio_aprobado.disconnect(_receptor)

    assert recibidos == [registro.id]


def test_rechazar_registro_exige_motivo(negocio_con_barbero):
    negocio, dueno, barbero, servicio = negocio_con_barbero
    registro = services.registrar_servicio(
        negocio=negocio, empleado=barbero, servicio=servicio,
        nombre_cliente="Cliente", fecha_hora=AYER,
    )

    with pytest.raises(services.MotivoRechazoRequerido):
        services.rechazar_registro(registro=registro, revisor=dueno, motivo="   ")


def test_rechazar_registro_guarda_el_motivo(negocio_con_barbero):
    negocio, dueno, barbero, servicio = negocio_con_barbero
    registro = services.registrar_servicio(
        negocio=negocio, empleado=barbero, servicio=servicio,
        nombre_cliente="Cliente", fecha_hora=AYER,
    )

    rechazado = services.rechazar_registro(
        registro=registro, revisor=dueno, motivo="No coincide con el catálogo."
    )

    assert rechazado.estado == RegistroServicio.Estado.RECHAZADO
    assert rechazado.motivo_rechazo == "No coincide con el catálogo."
    assert rechazado.aprobado_por_id == dueno.id


def test_no_se_puede_revisar_dos_veces(negocio_con_barbero):
    negocio, dueno, barbero, servicio = negocio_con_barbero
    registro = services.registrar_servicio(
        negocio=negocio, empleado=barbero, servicio=servicio,
        nombre_cliente="Cliente", fecha_hora=AYER,
    )
    services.aprobar_registro(registro=registro, revisor=dueno)

    with pytest.raises(services.RegistroYaRevisado):
        services.aprobar_registro(registro=registro, revisor=dueno)


def test_no_puede_aprobarse_su_propio_registro(negocio_con_barbero, empleado_con):
    negocio, _dueno, barbero, servicio = negocio_con_barbero
    validador, _client = empleado_con(
        negocio=negocio,
        email="validador@test.com",
        nombre="Validador",
        capacidades=["puede_aprobar_servicios"],
    )
    registro = services.registrar_servicio(
        negocio=negocio, empleado=validador, servicio=servicio,
        nombre_cliente="Cliente", fecha_hora=AYER,
    )

    with pytest.raises(services.NoPuedeAutoaprobarse):
        services.aprobar_registro(registro=registro, revisor=validador)
