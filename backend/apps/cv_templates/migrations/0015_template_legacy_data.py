"""CVT-1c (bước 1): giữ dữ liệu trước khi gỡ cột legacy của `CvTemplate`.

- template đã publish nhưng đang tắt bằng `status=inactive` chuyển về `draft`
  để vẫn ẩn khỏi kho mẫu khi `lifecycle_status` là nguồn sự thật duy nhất;
- ảnh `thumbnail_url`/`preview_url` của template chép sang color link còn trống.
"""

from django.db import migrations


def forwards(apps, schema_editor):
    CvTemplate = apps.get_model('cv_templates', 'CvTemplate')
    CvTemplateColorLink = apps.get_model('cv_templates', 'CvTemplateColorLink')
    CvTemplate.objects.filter(status='inactive', lifecycle_status='published').update(
        lifecycle_status='draft'
    )
    for template in CvTemplate.objects.exclude(thumbnail_url='', preview_url=''):
        links = CvTemplateColorLink.objects.filter(template=template)
        links.filter(thumbnail_url='').update(thumbnail_url=template.thumbnail_url)
        links.filter(preview_url='').update(
            preview_url=template.preview_url or template.thumbnail_url
        )


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0014_drop_legacy_sample_fields_blueprint'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
