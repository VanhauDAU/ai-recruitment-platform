"""Folded job title column with a trigram index for accent-insensitive search.

pg_trgm is installed by ``employers.0001_initial`` (a dependency of jobs.0001).
"""

import django.contrib.postgres.indexes
from django.db import migrations, models

from common.db.search import fold_accents

BATCH_SIZE = 1000


def fill_title_search(apps, schema_editor):
    Job = apps.get_model('jobs', 'Job')
    batch = []
    for job in Job.objects.only('id', 'title').iterator(chunk_size=BATCH_SIZE):
        job.title_search = fold_accents(job.title)
        batch.append(job)
        if len(batch) >= BATCH_SIZE:
            Job.objects.bulk_update(batch, ['title_search'])
            batch = []
    if batch:
        Job.objects.bulk_update(batch, ['title_search'])


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0007_backfill_workplace_coordinates'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='title_search',
            field=models.CharField(blank=True, editable=False, max_length=255),
        ),
        migrations.RunPython(fill_title_search, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name='job',
            index=django.contrib.postgres.indexes.GinIndex(
                fields=['title_search'],
                name='jobs_job_title_trgm_idx',
                opclasses=['gin_trgm_ops'],
            ),
        ),
    ]
