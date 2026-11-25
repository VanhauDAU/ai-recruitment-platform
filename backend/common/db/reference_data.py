"""Nạp dữ liệu tham chiếu (định dạng ``dumpdata``) trong data migration.

Dữ liệu ứng dụng cần ngay sau ``migrate`` — section CV, ngành nghề, phúc lợi,
ngôn ngữ, bài trợ giúp, cấu hình site mặc định — nằm trong
``<app>/migrations/reference_data.json`` và được nạp bằng model lịch sử của
migration, nên không phụ thuộc code model hiện tại. Seed nền và dữ liệu demo
không thuộc đây; danh sách lệnh seed và thứ tự chạy nằm ở
``scripts/reset_local_db.sh``.
"""

import json
from pathlib import Path

from django.core.management.color import no_style


def _rows(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def load_reference_data(apps, schema_editor, path):
    alias = schema_editor.connection.alias
    touched = []
    relations = []
    for row in _rows(path):
        model = apps.get_model(row['model'])
        values = {}
        for name, value in row['fields'].items():
            field = model._meta.get_field(name)
            if field.many_to_many:
                relations.append((model, row['pk'], name, value))
            elif field.is_relation:
                values[field.attname] = value
            else:
                values[name] = field.to_python(value)
        model.objects.using(alias).create(pk=row['pk'], **values)
        if model not in touched:
            touched.append(model)
    for model, pk, name, value in relations:
        getattr(model.objects.using(alias).get(pk=pk), name).set(value)
    # Chèn pk tường minh không đẩy sequence; đặt lại để bản ghi tạo sau không trùng id.
    for sql in schema_editor.connection.ops.sequence_reset_sql(no_style(), touched):
        schema_editor.execute(sql)


def unload_reference_data(apps, schema_editor, path):
    alias = schema_editor.connection.alias
    for row in reversed(_rows(path)):
        apps.get_model(row['model']).objects.using(alias).filter(pk=row['pk']).delete()
