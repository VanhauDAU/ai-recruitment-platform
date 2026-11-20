"""Gỡ trạng thái và cột của bước duyệt blog cũ (ADR-0024)."""

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0003_publish_without_review'),
        ('jobs', '0002_reference_data'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='post',
            options={'ordering': ['-published_at', '-created_at'], 'verbose_name': 'Bài viết', 'verbose_name_plural': 'Bài viết'},
        ),
        migrations.RemoveConstraint(
            model_name='post',
            name='chk_blog_post_status',
        ),
        migrations.RemoveField(
            model_name='post',
            name='submitted_at',
        ),
        migrations.RemoveField(
            model_name='postworkingcopy',
            name='status',
        ),
        migrations.RemoveField(
            model_name='postworkingcopy',
            name='submitted_at',
        ),
        migrations.AlterField(
            model_name='post',
            name='status',
            field=models.CharField(choices=[('draft', 'Nháp'), ('published', 'Đã xuất bản'), ('archived', 'Đã gỡ')], default='draft', max_length=20),
        ),
        migrations.AddConstraint(
            model_name='post',
            constraint=models.CheckConstraint(condition=models.Q(('status__in', ['draft', 'published', 'archived'])), name='chk_blog_post_status'),
        ),
    ]
