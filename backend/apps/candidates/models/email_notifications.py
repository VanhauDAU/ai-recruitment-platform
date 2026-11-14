from django.db import models

from .profile import CandidateProfile


class CandidateEmailNotificationSettings(models.Model):
    """Candidate-managed notification channels (email and website bell).

    Every field here has a consumer; a switch nobody reads is not offered.
    Recruiter decisions on an application (shortlisted, interview, result)
    are mandatory and have no switch. Job recommendation emails stay opt-in
    because they read profile/CV signals.
    """

    candidate_profile = models.OneToOneField(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='email_notification_settings',
    )

    # Hồ sơ ứng tuyển — hai kênh.
    application_received_email = models.BooleanField(default=True)
    application_received_web = models.BooleanField(default=True)
    similar_jobs_in_application_email = models.BooleanField(default=True)
    cv_activity_email = models.BooleanField(default=True)
    cv_activity_web = models.BooleanField(default=True)
    # Invitations to apply from a recruiter's talent pool.
    employer_invitation_email = models.BooleanField(default=True)
    employer_invitation_web = models.BooleanField(default=True)

    # Email việc làm (consumer: apps/jobs/services/digests.py).
    configured_job_alerts = models.BooleanField(default=True)
    suitable_job_recommendations = models.BooleanField(default=False)
    followed_company_jobs = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_email_notification_settings'

    def __str__(self):
        return f'CandidateEmailNotificationSettings<{self.candidate_profile.user_id}>'
