"""CVT-1c: gỡ cột legacy của `UserCv`.

`cv_data`/`style_config`/`status`/`current_version` là bản sao cho client V1 đã
gỡ; `raw_text`/`normalized_text` luôn rỗng (không lưu văn bản thô của CV);
`pdf_url` không còn được ghi; `last_analyzed_at` trùng `CvImportJob.completed_at`.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('cvs', '0012_usercv_experience_years'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='usercv', name='chk_user_cvs_status'),
        *[
            migrations.RemoveField(model_name='usercv', name=name)
            for name in (
                'cv_data',
                'style_config',
                'status',
                'current_version',
                'raw_text',
                'normalized_text',
                'pdf_url',
                'last_analyzed_at',
            )
        ],
    ]
