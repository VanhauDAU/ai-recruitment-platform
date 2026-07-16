from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('cvs', '0009_cvversion_detach_after_hard_delete'),
    ]

    operations = [
        migrations.CreateModel(
            name='CvAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('kind', models.CharField(choices=[('avatar', 'Avatar'), ('background', 'Background')], max_length=20)),
                ('title', models.CharField(blank=True, max_length=120)),
                ('storage_key', models.TextField()),
                ('content_type', models.CharField(max_length=100)),
                ('size_bytes', models.PositiveIntegerField()),
                ('width', models.PositiveIntegerField()),
                ('height', models.PositiveIntegerField()),
                ('checksum_sha256', models.CharField(db_index=True, max_length=64)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cv_assets', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='cvasset',
            index=models.Index(fields=['kind', 'is_active', 'created_at'], name='idx_cv_assets_catalog'),
        ),
        migrations.AddIndex(
            model_name='cvasset',
            index=models.Index(fields=['owner', 'kind', 'created_at'], name='idx_cv_assets_owner_kind'),
        ),
    ]
