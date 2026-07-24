"""Write workflows for candidate email notification settings."""

from django.db import transaction

from ..models import CandidateEmailNotificationSettings, CandidateProfile


@transaction.atomic
def patch_candidate_email_notification_settings(user, changes):
    """Apply a partial settings update, creating the aggregate on first write."""
    profile, _ = CandidateProfile.objects.select_for_update().get_or_create(user=user)
    settings, _ = CandidateEmailNotificationSettings.objects.update_or_create(
        candidate_profile=profile,
        defaults=changes,
    )
    return settings
