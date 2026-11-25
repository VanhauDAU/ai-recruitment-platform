"""Đổi mã tài khoản `usr_<hex>` sang 8 chữ số và đồng bộ nhật ký quản trị.

Nhật ký `AdminAccessAuditLog` lưu mã tài khoản dạng chuỗi (timeline tài khoản lọc
theo `target_public_id`), nên phải ghi lại theo mã mới để lịch sử không mất. File
storage cũ (`users/avatars/usr_…/`) vẫn dùng được vì DB lưu đường dẫn đầy đủ.

Tách khỏi bước đổi schema (0005): cập nhật hàng loạt bảng users trong cùng giao
dịch với ALTER TABLE dễ vấp lỗi "pending trigger events" của khóa ngoại deferred.
"""

import re
import secrets

from django.db import migrations

# Sao chép cố định từ apps.accounts.domain.account_code để migration không đổi
# hành vi khi code ứng dụng thay đổi về sau.
CODE = re.compile(r'^[1-9][0-9]{7}$')


def _random_code():
    return str(10**7 + secrets.randbelow(9 * 10**7))


def numeric_public_ids(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    AuditLog = apps.get_model('accounts', 'AdminAccessAuditLog')

    taken = {pid for pid in User.objects.values_list('public_id', flat=True) if CODE.match(pid)}
    mapping = {}
    users = []
    for user in User.objects.only('pk', 'public_id').order_by('pk').iterator():
        if CODE.match(user.public_id):
            continue
        code = _random_code()
        while code in taken:
            code = _random_code()
        taken.add(code)
        mapping[user.public_id] = code
        user.public_id = code
        users.append(user)
    User.objects.bulk_update(users, ['public_id'], batch_size=1000)
    if not mapping:
        return

    logs = []
    for log in AuditLog.objects.filter(target_public_id__in=list(mapping), target_type='user'):
        log.target_public_id = mapping[log.target_public_id]
        logs.append(log)
    AuditLog.objects.bulk_update(logs, ['target_public_id'], batch_size=1000)

    logs = []
    for log in AuditLog.objects.filter(payload__has_key='user_public_id').iterator():
        old = log.payload.get('user_public_id')
        if old in mapping:
            log.payload = {**log.payload, 'user_public_id': mapping[old]}
            logs.append(log)
    AuditLog.objects.bulk_update(logs, ['payload'], batch_size=1000)


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0003_admin_audit_target_idx'),
    ]

    operations = [
        # Không đảo ngược được mã cũ; quay lại 0003 vẫn giữ mã số (hợp lệ với schema cũ).
        migrations.RunPython(numeric_public_ids, migrations.RunPython.noop),
    ]
