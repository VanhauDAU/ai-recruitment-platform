import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0034_employer_verification_state_machine'),
        ('uploads', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='companydocument',
            name='upload_asset',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='employer_document',
                to='uploads.uploadasset',
            ),
        ),
        migrations.CreateModel(
            name='CompanyMediaUpload',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                (
                    'kind',
                    models.CharField(
                        choices=[
                            ('logo', 'Logo'),
                            ('cover', 'Ảnh bìa'),
                            ('gallery', 'Ảnh giới thiệu'),
                        ],
                        max_length=20,
                    ),
                ),
                ('public_path', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'company',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='media_upload_records',
                        to='employers.company',
                    ),
                ),
                (
                    'update_request',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='media_upload_records',
                        to='employers.companyupdaterequest',
                    ),
                ),
                (
                    'upload_asset',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='employer_company_media',
                        to='uploads.uploadasset',
                    ),
                ),
                (
                    'uploaded_by',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name='companymediaupload',
            index=models.Index(
                fields=['company', 'kind', '-created_at'], name='emp_media_company_kind_idx'
            ),
        ),
    ]
