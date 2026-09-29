from django.db import models

from .profile import CandidateProfile


class CandidateEmailNotificationSettings(models.Model):
    """Candidate-managed email notification categories.

    Recommendation emails are deliberately opt-in because they read profile/CV
    signals. The remaining categories preserve the historical enabled defaults.
    """

    candidate_profile = models.OneToOneField(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='email_notification_settings',
    )

    # Thông báo từ hệ thống.
    important_system_updates = models.BooleanField(default=True)
    employer_viewed_cv = models.BooleanField(default=True)
    new_features_and_cv_templates = models.BooleanField(default=True)
    other_system_notifications = models.BooleanField(default=True)

    # Thông báo cơ hội việc làm.
    configured_job_alerts = models.BooleanField(default=True)
    suitable_job_recommendations = models.BooleanField(default=False)
    top_candidate_alerts = models.BooleanField(default=True)
    employer_invitations = models.BooleanField(default=True)
    job_and_career_events = models.BooleanField(default=True)

    # Thông báo giới thiệu dịch vụ.
    service_introductions = models.BooleanField(default=True)
    program_and_event_introductions = models.BooleanField(default=True)
    partner_gifts_and_discounts = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_email_notification_settings'

    def __str__(self):
        return f'CandidateEmailNotificationSettings<{self.candidate_profile.user_id}>'
