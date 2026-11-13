"""CVT-1b (bước 3): bỏ cột cũ của nội dung mẫu và bảng blueprint.

Tách khỏi 0012 vì PostgreSQL không cho ALTER TABLE trong cùng transaction với
các thay đổi dữ liệu còn trigger FK chờ xử lý.
"""

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ('cv_templates', '0013_position_profiles_sample_bands_data'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='cvsamplecontent', name='uq_cv_sample_position_locale_level'
        ),
        migrations.RemoveIndex(model_name='cvsamplecontent', name='idx_cv_samples_catalog'),
        migrations.RemoveField(model_name='cvsamplecontent', name='job_category'),
        migrations.RemoveField(model_name='cvsamplecontent', name='position_name_vi'),
        migrations.RemoveField(model_name='cvsamplecontent', name='experience_level'),
        migrations.AlterModelOptions(
            name='cvsamplecontent',
            options={'ordering': ['locale', 'experience_band', 'title']},
        ),
        migrations.AddIndex(
            model_name='cvsamplecontent',
            index=models.Index(
                fields=['status', 'locale', 'experience_band'], name='idx_cv_samples_catalog'
            ),
        ),
        migrations.AddConstraint(
            model_name='cvsamplecontent',
            constraint=models.UniqueConstraint(
                condition=Q(position_profile__isnull=False),
                fields=('position_profile', 'locale', 'experience_band'),
                name='uq_cv_sample_position_locale_band',
            ),
        ),
        migrations.AddConstraint(
            model_name='cvsamplecontent',
            constraint=models.UniqueConstraint(
                condition=Q(position_profile__isnull=True),
                fields=('locale', 'experience_band'),
                name='uq_cv_sample_generic_locale_band',
            ),
        ),
        migrations.DeleteModel(name='CvContentBlueprint'),
    ]
