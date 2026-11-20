"""Gỡ cột của bước duyệt cũ và chốt trạng thái revision DRAFT/PUBLISHED (ADR-0024)."""

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('knowledgebase', '0003_publish_without_review'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(model_name='knowledgearticlerevision', name='review_note'),
        migrations.RemoveField(model_name='knowledgearticlerevision', name='reviewed_at'),
        migrations.RemoveField(model_name='knowledgearticlerevision', name='reviewed_by'),
        migrations.RemoveField(model_name='knowledgearticlerevision', name='submitted_at'),
        migrations.RemoveField(model_name='knowledgearticlerevision', name='submitted_by'),
        migrations.AlterField(
            model_name='knowledgearticlerevision',
            name='status',
            field=models.CharField(
                choices=[('DRAFT', 'Nháp'), ('PUBLISHED', 'Đã xuất bản')],
                default='DRAFT',
                max_length=12,
            ),
        ),
        migrations.AddConstraint(
            model_name='knowledgearticlerevision',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'DRAFT')),
                fields=('article',),
                name='uq_kb_revision_open_article',
            ),
        ),
    ]
