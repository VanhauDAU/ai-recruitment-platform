import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('blog', '0003_tag_is_active'),
    ]

    operations = [
        migrations.CreateModel(
            name='BlogMediaAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('storage_key', models.TextField(unique=True)),
                ('original_name', models.CharField(max_length=255)),
                ('content_type', models.CharField(max_length=100)),
                ('size', models.PositiveBigIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_blog_media', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Ảnh nội dung blog',
                'verbose_name_plural': 'Kho ảnh nội dung blog',
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['-created_at'], name='blog_media_created_idx')],
            },
        ),
    ]
