"""Link footer/banner đã lưu trỏ sang path tiếng Việt (path cũ vẫn redirect ở frontend)."""

from django.db import migrations

PATHS = {
    '/login': '/dang-nhap',
    '/sign-up': '/dang-ky',
    '/register': '/dang-ky',
    '/forgot-password': '/quen-mat-khau',
    '/onboard-user': '/hoan-thien-ho-so',
    '/tuyendung/app/login': '/tuyendung/app/dang-nhap',
    '/tuyendung/app/register': '/tuyendung/app/dang-ky',
    '/tuyendung/app/dashboard': '/tuyendung/app/tong-quan',
    '/tuyendung/app/jobs/new': '/tuyendung/app/tin-tuyen-dung/tao-moi',
    '/tuyendung/app/candidate-search': '/tuyendung/app/tim-ung-vien',
}


def _rewrite(apps, mapping):
    LinkItem = apps.get_model('sitecontent', 'LinkItem')
    Banner = apps.get_model('sitecontent', 'Banner')
    for old, new in mapping.items():
        LinkItem.objects.filter(url=old).update(url=new)
        Banner.objects.filter(cta_url=old).update(cta_url=new)
        Banner.objects.filter(cta_secondary_url=old).update(cta_secondary_url=new)


def forwards(apps, schema_editor):
    _rewrite(apps, PATHS)


def backwards(apps, schema_editor):
    # '/dang-ky' có hai nguồn; quay về '/sign-up' là route đăng ký ứng viên chính trước đây.
    reverse = {new: old for old, new in PATHS.items() if old != '/register'}
    _rewrite(apps, reverse)


class Migration(migrations.Migration):
    dependencies = [
        ('sitecontent', '0012_feedback_bug_client_info'),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
