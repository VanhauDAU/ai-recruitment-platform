"""Bỏ bước gửi duyệt của blog (ADR-0024): bài và bản sửa đang chờ duyệt trở về nháp.

Schema đổi ở 0004.
"""

from django.db import migrations


def pending_to_draft(apps, schema_editor):
    apps.get_model('blog', 'Post').objects.filter(status='pending').update(
        status='draft', submitted_at=None
    )
    apps.get_model('blog', 'PostWorkingCopy').objects.filter(status='pending').update(
        status='draft', submitted_at=None
    )


class Migration(migrations.Migration):
    dependencies = [('blog', '0002_initial')]

    operations = [migrations.RunPython(pending_to_draft, migrations.RunPython.noop)]
