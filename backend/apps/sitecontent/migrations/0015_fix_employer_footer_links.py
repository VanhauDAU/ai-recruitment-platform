# Sửa link footer "Dành cho nhà tuyển dụng" trỏ sai prefix /nha-tuyen-dung
# (route thật là /tuyendung). Seed chỉ tạo LinkItem khi group mới, nên DB đã
# seed từ trước phải sửa bằng data migration.
from django.db import migrations

URL_FIXES = {
    '/nha-tuyen-dung': '/tuyendung',
    '/nha-tuyen-dung/dich-vu': '/tuyendung/dich-vu',
    '/nha-tuyen-dung/bang-gia': '/tuyendung/bao-gia',
    '/nha-tuyen-dung/dang-nhap': '/tuyendung/app/login',
}


def fix_employer_footer_links(apps, schema_editor):
    LinkItem = apps.get_model('sitecontent', 'LinkItem')
    for old_url, new_url in URL_FIXES.items():
        LinkItem.objects.filter(group__key='footer-employer', url=old_url).update(url=new_url)


def revert_employer_footer_links(apps, schema_editor):
    LinkItem = apps.get_model('sitecontent', 'LinkItem')
    for old_url, new_url in URL_FIXES.items():
        LinkItem.objects.filter(group__key='footer-employer', url=new_url).update(url=old_url)


class Migration(migrations.Migration):

    dependencies = [
        ('sitecontent', '0014_alter_banner_placement'),
    ]

    operations = [
        migrations.RunPython(fix_employer_footer_links, revert_employer_footer_links),
    ]
