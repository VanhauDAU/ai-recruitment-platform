"""Mỗi ứng viên chỉ còn một CV bật cho nhà tuyển dụng tìm kiếm.

Ứng viên đang bật nhiều CV: giữ CV chính nếu nó đang bật, không thì CV cập nhật gần
nhất; các CV còn lại tắt. Sau đó thêm ràng buộc duy nhất có điều kiện.
"""

from django.db import migrations, models


def keep_one_searchable_cv(apps, schema_editor):
    UserCv = apps.get_model('cvs', 'UserCv')
    searchable = UserCv.objects.filter(recruiter_searchable=True, is_deleted=False)
    user_ids = (
        searchable.values('user_id')
        .annotate(total=models.Count('id'))
        .filter(total__gt=1)
        .values_list('user_id', flat=True)
    )
    for user_id in list(user_ids):
        keep = searchable.filter(user_id=user_id).order_by('-is_default', '-updated_at', '-id').first()
        searchable.filter(user_id=user_id).exclude(pk=keep.pk).update(recruiter_searchable=False)


class Migration(migrations.Migration):
    dependencies = [
        ('cvs', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(keep_one_searchable_cv, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='usercv',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_deleted', False), ('recruiter_searchable', True)),
                fields=('user',),
                name='uq_user_searchable_cv',
            ),
        ),
    ]
