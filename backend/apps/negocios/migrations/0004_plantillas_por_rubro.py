"""Las plantillas del perfil público pasan a nombrarse por rubro.

Antes eran dos composiciones neutras (`estandar`, `vitrina`); ahora son
tres diseños completos con paleta, radios y tipografía propios
(`barberia`, `spa`, `clinica`). El `AlterField` solo no alcanza: sin la
migración de datos, los negocios existentes se quedarían con un valor que
ya no está en `choices` — el frontend caería en la plantilla por defecto
y nadie se enteraría de que el dato quedó muerto en la base.

El mapeo va por parecido visual: `vitrina` era el encabezado a pantalla
completa con velo oscuro, que es lo más cercano a `barberia`; `estandar`
era claro y compacto, más cerca de `spa`.
"""

from django.db import migrations, models

MAPEO = {"vitrina": "barberia", "estandar": "spa"}


def renombrar_a_rubros(apps, schema_editor):
    Negocio = apps.get_model("negocios", "Negocio")
    for viejo, nuevo in MAPEO.items():
        Negocio.objects.filter(tema=viejo).update(tema=nuevo)


def volver_a_composiciones(apps, schema_editor):
    """Marcha atrás: `clinica` no existía antes, así que cae en la
    composición estándar, que es la que más se le parece."""
    Negocio = apps.get_model("negocios", "Negocio")
    Negocio.objects.filter(tema="barberia").update(tema="vitrina")
    Negocio.objects.filter(tema__in=["spa", "clinica"]).update(tema="estandar")


class Migration(migrations.Migration):

    dependencies = [
        ("negocios", "0003_negocio_color_acento_negocio_portada_negocio_tema"),
    ]

    operations = [
        migrations.AlterField(
            model_name="negocio",
            name="tema",
            field=models.CharField(
                choices=[
                    ("barberia", "Barbería"),
                    ("spa", "Spa y estética"),
                    ("clinica", "Clínica y salud"),
                ],
                default="spa",
                max_length=20,
            ),
        ),
        migrations.RunPython(renombrar_a_rubros, volver_a_composiciones),
    ]
