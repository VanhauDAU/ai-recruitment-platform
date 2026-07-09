# Bật extension unaccent của Postgres để tìm kiếm tiếng Việt không dấu
# (lookup `__unaccent` của django.contrib.postgres).
from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0007_backfill_filter_fields'),
    ]

    operations = [
        UnaccentExtension(),
    ]
