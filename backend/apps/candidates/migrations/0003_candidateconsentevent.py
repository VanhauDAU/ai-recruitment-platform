from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [('candidates', '0002_candidateprofile_job_preferences_configured_and_more')]

    operations = [
        migrations.CreateModel(
            name='CandidateConsentEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('consent_type', models.CharField(choices=[('ai_recommendation', 'Gợi ý việc làm bằng AI'), ('recruiter_visibility', 'Hiển thị với nhà tuyển dụng')], max_length=30)),
                ('decision', models.CharField(choices=[('granted', 'Đồng ý'), ('denied', 'Không đồng ý')], max_length=20)),
                ('policy_version', models.CharField(default='v1', max_length=64)),
                ('source', models.CharField(max_length=64)),
                ('source_path', models.TextField(blank=True)),
                ('cv_public_id', models.CharField(blank=True, max_length=50)),
                ('decided_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('candidate_profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consent_events', to='candidates.candidateprofile')),
            ],
            options={'db_table': 'candidate_consent_events', 'ordering': ['-decided_at', '-id']},
        ),
        migrations.AddIndex(
            model_name='candidateconsentevent',
            index=models.Index(fields=['candidate_profile', 'consent_type', '-decided_at'], name='candidate_consent_event_lookup'),
        ),
    ]
