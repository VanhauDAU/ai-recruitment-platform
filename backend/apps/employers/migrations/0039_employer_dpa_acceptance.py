import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0024_employer_verification_resubmission_unlock_permission'),
        ('employers', '0038_backfill_company_update_lifecycle_v2'),
    ]

    operations = [
        migrations.AddField(
            model_name='recruiterprofile',
            name='dpa_policy_version',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='dpa_document_sha256',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.CreateModel(
            name='EmployerDpaAcceptance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_id', models.CharField(editable=False, max_length=50, unique=True)),
                ('policy_version', models.CharField(max_length=64)),
                ('document_sha256', models.CharField(max_length=64)),
                ('document_url', models.URLField(max_length=500)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent_hash', models.CharField(blank=True, max_length=64)),
                ('accepted_at', models.DateTimeField(auto_now_add=True)),
                (
                    'auth_session',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='employer_dpa_acceptances',
                        to='accounts.authsession',
                    ),
                ),
                (
                    'recruiter',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='dpa_acceptances',
                        to='employers.recruiterprofile',
                    ),
                ),
            ],
            options={'ordering': ['-accepted_at', '-id']},
        ),
        migrations.AddIndex(
            model_name='employerdpaacceptance',
            index=models.Index(
                fields=['recruiter', '-accepted_at'],
                name='employer_dpa_rec_accepted_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='employerdpaacceptance',
            index=models.Index(
                fields=['policy_version', 'document_sha256'],
                name='employer_dpa_policy_hash_idx',
            ),
        ),
        migrations.AddConstraint(
            model_name='employerdpaacceptance',
            constraint=models.UniqueConstraint(
                fields=('recruiter', 'policy_version', 'document_sha256'),
                name='uniq_employer_dpa_exact_acceptance',
            ),
        ),
        migrations.AddConstraint(
            model_name='employerdpaacceptance',
            constraint=models.CheckConstraint(
                condition=models.Q(document_sha256__regex='^[0-9a-f]{64}$'),
                name='employer_dpa_sha256_lower_hex',
            ),
        ),
    ]
