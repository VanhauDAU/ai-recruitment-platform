import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_public_ids(apps, schema_editor):
    import uuid

    for model_name, prefix in (
        ('PostCategory', 'pcat'),
        ('Tag', 'ptag'),
        ('PinnedPost', 'ppin'),
    ):
        model = apps.get_model('blog', model_name)
        for item in model.objects.filter(public_id__isnull=True).iterator():
            item.public_id = f'{prefix}_{uuid.uuid4().hex[:12]}'
            item.save(update_fields=['public_id'])


class Migration(migrations.Migration):
    dependencies = [
        ('blog', '0001_initial'),
        ('jobs', '0031_job_currency_choices'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='pinnedpost',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='postcategory',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='tag',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, null=True),
        ),
        migrations.RunPython(backfill_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='pinnedpost',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
        migrations.AlterField(
            model_name='postcategory',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
        migrations.AlterField(
            model_name='tag',
            name='public_id',
            field=models.CharField(editable=False, max_length=50, unique=True),
        ),
        migrations.AddField(
            model_name='post',
            name='edit_revision',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='post',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='PostWorkingCopy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('title', models.CharField(max_length=255)),
                ('summary', models.CharField(blank=True, max_length=500)),
                ('thumbnail_url', models.TextField(blank=True)),
                ('content', models.TextField()),
                ('seo_title', models.CharField(blank=True, max_length=200)),
                ('seo_description', models.CharField(blank=True, max_length=300)),
                ('status', models.CharField(choices=[('draft', 'Nháp'), ('pending', 'Chờ duyệt')], default='draft', max_length=20)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('edit_revision', models.PositiveIntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='working_copies', to='blog.postcategory')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_blog_working_copies', to=settings.AUTH_USER_MODEL)),
                ('post', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='working_copy', to='blog.post')),
                ('related_job_category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='blog_working_copies', to='jobs.jobcategory')),
                ('tags', models.ManyToManyField(blank=True, related_name='working_copies', to='blog.tag')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_blog_working_copies', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-updated_at']},
        ),
        migrations.CreateModel(
            name='PostStatusHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('action', models.CharField(max_length=40)),
                ('from_status', models.CharField(blank=True, max_length=30)),
                ('to_status', models.CharField(max_length=30)),
                ('note', models.CharField(blank=True, max_length=1000)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='blog_status_changes', to=settings.AUTH_USER_MODEL)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_history', to='blog.post')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['post', '-created_at'], name='blog_history_post_created_idx')],
            },
        ),
    ]
