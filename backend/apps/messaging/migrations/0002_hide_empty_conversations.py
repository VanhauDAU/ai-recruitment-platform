"""Hội thoại chỉ có tin hệ thống "bắt đầu" (bấm Nhắn tin mà chưa gửi gì) trước đây vẫn
được tính là hoạt động: hiện ở danh sách hai bên và tăng chưa đọc. Đưa chúng về trạng
thái chưa hoạt động như luồng mới (chỉ hiện khi có tin thật đầu tiên)."""

from django.db import migrations
from django.db.models import Exists, OuterRef


def forwards(apps, schema_editor):
    Conversation = apps.get_model('messaging', 'Conversation')
    Message = apps.get_model('messaging', 'Message')
    real = Message.objects.filter(conversation=OuterRef('pk')).exclude(kind='system')
    Conversation.objects.annotate(has_real=Exists(real)).filter(has_real=False).update(
        last_message_at=None,
        last_message_preview='',
        last_message_kind='',
        last_sender_role='',
        candidate_unread=0,
        recruiter_unread=0,
    )


class Migration(migrations.Migration):
    dependencies = [('messaging', '0001_initial')]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
