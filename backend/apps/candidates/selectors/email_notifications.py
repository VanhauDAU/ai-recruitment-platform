"""Read queries for candidate email notification settings."""

from ..models import CandidateEmailNotificationSettings


def candidate_email_notification_settings_for_user(user):
    """Return persisted settings or an unsaved object containing model defaults."""
    settings = CandidateEmailNotificationSettings.objects.filter(
        candidate_profile__user=user
    ).first()
    return settings or CandidateEmailNotificationSettings()
