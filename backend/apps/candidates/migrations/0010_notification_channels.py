"""Notification settings that match real events, per channel (email / website).

* ``employer_viewed_cv`` becomes ``cv_activity_email`` (data kept).
* Nine switches that no code ever read are dropped.
* New: application received (email + web), CV activity on the web, similar
  jobs inside the confirmation email.
* ``CandidateNotification`` gains the ``application_submitted`` event and
  ``show_in_inbox`` (website channel decided at emit time).
"""

from django.db import migrations, models
from django.db.models import Q

DEAD_FIELDS = [
    'important_system_updates',
    'new_features_and_cv_templates',
    'other_system_notifications',
    'top_candidate_alerts',
    'employer_invitations',
    'job_and_career_events',
    'service_introductions',
    'program_and_event_introductions',
    'partner_gifts_and_discounts',
]
SETTINGS = 'candidateemailnotificationsettings'


class Migration(migrations.Migration):
    dependencies = [
        ('candidates', '0009_candidatenotification'),
    ]

    operations = [
        migrations.RenameField(
            model_name=SETTINGS, old_name='employer_viewed_cv', new_name='cv_activity_email'
        ),
        *[migrations.RemoveField(model_name=SETTINGS, name=name) for name in DEAD_FIELDS],
        *[
            migrations.AddField(
                model_name=SETTINGS, name=name, field=models.BooleanField(default=True)
            )
            for name in (
                'application_received_email',
                'application_received_web',
                'similar_jobs_in_application_email',
                'cv_activity_web',
            )
        ],
        migrations.AlterField(
            model_name='candidatenotification',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('application_submitted', 'Hồ sơ đã được tiếp nhận'),
                    ('application_viewed', 'Nhà tuyển dụng đã xem hồ sơ'),
                    ('application_cv_downloaded', 'Nhà tuyển dụng đã tải CV'),
                    ('application_shortlisted', 'Hồ sơ phù hợp'),
                    ('application_interviewed', 'Mời phỏng vấn'),
                    ('application_accepted', 'Trúng tuyển'),
                    ('application_rejected', 'Chưa phù hợp'),
                ],
                max_length=48,
            ),
        ),
        migrations.AddField(
            model_name='candidatenotification',
            name='show_in_inbox',
            field=models.BooleanField(default=True),
        ),
        migrations.RemoveIndex(model_name='candidatenotification', name='cand_notice_inbox_idx'),
        migrations.RemoveIndex(model_name='candidatenotification', name='cand_notice_unread_idx'),
        migrations.AddIndex(
            model_name='candidatenotification',
            index=models.Index(
                condition=Q(delivered_at__isnull=False, show_in_inbox=True),
                fields=['recipient', '-delivered_at'],
                name='cand_notice_inbox_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='candidatenotification',
            index=models.Index(
                condition=Q(delivered_at__isnull=False, read_at__isnull=True, show_in_inbox=True),
                fields=['recipient'],
                name='cand_notice_unread_idx',
            ),
        ),
    ]
