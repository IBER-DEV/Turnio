"""Las capacidades pasan de la membresía al cargo.

El autogenerado ponía los `RemoveField` **antes** de crear `Cargo`, con lo
cual los permisos de todo el mundo se perdían. Acá el orden es el que
conserva los datos: crear el modelo, agregar el FK, **repartir la gente en
cargos deducidos de lo que ya podía hacer**, y recién entonces borrar las
columnas viejas.
"""

import django.db.models.deletion
from django.db import migrations, models

CAPACIDADES = (
    "puede_cobrar",
    "puede_ver_reportes",
    "puede_editar_precios",
    "puede_gestionar_empleados",
    "puede_gestionar_agenda",
    "puede_configurar_horarios",
    "puede_ver_agenda_completa",
)

#: Cómo se bautiza y clasifica una combinación de capacidades conocida.
#: Lo que no calce con ninguna se nombra "Cargo 1", "Cargo 2"… — feo pero
#: honesto: inventarle un nombre bonito a una combinación arbitraria sería
#: peor que dejar que el dueño la renombre.
CONOCIDOS = [
    (
        "Administración",
        "administracion",
        set(CAPACIDADES),
    ),
    (
        "Recepción",
        "recepcion",
        {"puede_cobrar", "puede_gestionar_agenda", "puede_ver_agenda_completa"},
    ),
    ("Barbero o estilista", "operativo", set()),
]


def _clasificar(capacidades):
    """Nombre y tipo para una combinación de capacidades.

    El tipo se deduce de lo que la combinación permite, porque es lo único
    disponible: quien gestiona el equipo va a administración, quien ve la
    agenda completa a recepción, el resto a operativo. Es un punto de
    partida — el dueño lo cambia desde la app.
    """
    for nombre, tipo, esperadas in CONOCIDOS:
        if capacidades == esperadas:
            return nombre, tipo

    if "puede_gestionar_empleados" in capacidades:
        return None, "administracion"
    if "puede_ver_agenda_completa" in capacidades:
        return None, "recepcion"
    return None, "operativo"


def repartir_en_cargos(apps, schema_editor):
    MiembroNegocio = apps.get_model("usuarios", "MiembroNegocio")
    Cargo = apps.get_model("usuarios", "Cargo")
    Negocio = apps.get_model("negocios", "Negocio")

    for negocio in Negocio.objects.all():
        miembros = list(MiembroNegocio.objects.filter(negocio=negocio))
        if not miembros:
            continue

        cargos_por_combinacion = {}
        anonimos = 0

        for miembro in miembros:
            combinacion = frozenset(
                campo for campo in CAPACIDADES if getattr(miembro, campo)
            )
            if combinacion not in cargos_por_combinacion:
                nombre, tipo = _clasificar(set(combinacion))
                if nombre is None:
                    anonimos += 1
                    nombre = f"Cargo {anonimos}"
                cargos_por_combinacion[combinacion] = Cargo.objects.create(
                    tenant=negocio.tenant,
                    negocio=negocio,
                    nombre=nombre,
                    tipo=tipo,
                    **{campo: campo in combinacion for campo in CAPACIDADES},
                )
            miembro.cargo = cargos_por_combinacion[combinacion]
            miembro.save(update_fields=["cargo"])


def devolver_a_la_membresia(apps, schema_editor):
    """Copia las capacidades del cargo de vuelta a cada membresía.

    Solo tiene efecto si se revierte esta migración estando las columnas
    ya restauradas por el `RemoveField` inverso, que Django ejecuta antes.
    """
    MiembroNegocio = apps.get_model("usuarios", "MiembroNegocio")
    for miembro in MiembroNegocio.objects.select_related("cargo"):
        if miembro.cargo is None:
            continue
        for campo in CAPACIDADES:
            setattr(miembro, campo, getattr(miembro.cargo, campo))
        miembro.save(update_fields=list(CAPACIDADES))


class Migration(migrations.Migration):

    dependencies = [
        ('negocios', '0001_initial'),
        ('tenants', '0001_initial'),
        ('usuarios', '0003_miembronegocio_puede_configurar_horarios_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Cargo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=80)),
                ('tipo', models.CharField(choices=[('administracion', 'Administración'), ('recepcion', 'Recepción'), ('operativo', 'Operativo')], default='operativo', max_length=20)),
                ('puede_cobrar', models.BooleanField(default=False)),
                ('puede_ver_reportes', models.BooleanField(default=False)),
                ('puede_editar_precios', models.BooleanField(default=False)),
                ('puede_gestionar_empleados', models.BooleanField(default=False)),
                ('puede_gestionar_agenda', models.BooleanField(default=False)),
                ('puede_configurar_horarios', models.BooleanField(default=False)),
                ('puede_ver_agenda_completa', models.BooleanField(default=False)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('negocio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cargos', to='negocios.negocio')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='tenants.tenant')),
            ],
            options={
                'ordering': ['nombre'],
            },
        ),
        migrations.AddConstraint(
            model_name='cargo',
            constraint=models.UniqueConstraint(fields=('negocio', 'nombre'), name='unico_cargo_por_negocio'),
        ),
        migrations.AddField(
            model_name='miembronegocio',
            name='cargo',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='miembros', to='usuarios.cargo'),
        ),
        # Antes de borrar nada: repartir a la gente en cargos deducidos de
        # las capacidades que ya tenía. Nadie gana ni pierde permisos.
        migrations.RunPython(repartir_en_cargos, devolver_a_la_membresia),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_cobrar',
        ),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_configurar_horarios',
        ),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_editar_precios',
        ),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_gestionar_agenda',
        ),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_gestionar_empleados',
        ),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_ver_agenda_completa',
        ),
        migrations.RemoveField(
            model_name='miembronegocio',
            name='puede_ver_reportes',
        ),
    ]
