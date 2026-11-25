"""Gán mã hiển thị J + 7 chữ số cho các tin tuyển dụng đã có (xem domain/job_code).

Tách khỏi bước đổi schema (0004): cập nhật hàng loạt trong cùng giao dịch với
ALTER TABLE dễ vấp lỗi "pending trigger events" của khóa ngoại deferred.
"""

import secrets

from django.db import migrations, models

# Sao chép cố định từ domain để migration không đổi hành vi khi code thay đổi.
LOWEST = 10 ** (7 - 1)


def _random_code():
    return f'J{LOWEST + secrets.randbelow(9 * LOWEST)}'


def assign_codes(apps, schema_editor):
    Model = apps.get_model('jobs', 'Job')
    taken = set(Model.objects.exclude(code=None).values_list('code', flat=True))
    rows = []
    for row in Model.objects.filter(code=None).only('pk').order_by('pk').iterator():
        code = _random_code()
        while code in taken:
            code = _random_code()
        taken.add(code)
        row.code = code
        rows.append(row)
    Model.objects.bulk_update(rows, ['code'], batch_size=1000)


class Migration(migrations.Migration):
    dependencies = [('jobs', '0002_reference_data')]

    operations = [
        migrations.AddField(
            model_name='job',
            name='code',
            field=models.CharField(editable=False, max_length=8, null=True, unique=True),
        ),
        migrations.RunPython(assign_codes, migrations.RunPython.noop),
    ]
