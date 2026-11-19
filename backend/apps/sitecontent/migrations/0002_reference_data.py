"""Dữ liệu tham chiếu của sitecontent (xem common.db.reference_data)."""

from functools import partial
from pathlib import Path

from django.db import migrations

from common.db.reference_data import load_reference_data, unload_reference_data

DATA = Path(__file__).with_name('reference_data.json')


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0001_initial')]

    operations = [
        migrations.RunPython(
            partial(load_reference_data, path=DATA),
            partial(unload_reference_data, path=DATA),
        ),
    ]
