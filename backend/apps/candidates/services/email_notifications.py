"""Write workflows for candidate email notification settings."""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.services import lock_account_for_write

from ..models import (
    CandidateConsent,
    CandidateEmailNotificationSettings,
    CandidateJobPreference,
    CandidateProfile,
)


def _reset_delivery_cursors(user, *, configured, suitable):
    """Reset inside the preference transaction so Beat cannot observe half a transition."""
    if not configured and not suitable:
        return

    from apps.jobs.services import reset_candidate_job_delivery_cursors

    reset_candidate_job_delivery_cursors(
        user,
        configured=configured,
        suitable=suitable,
    )


def _validate_suitable_recommendation_opt_in(profile, changes):
    if changes.get('suitable_job_recommendations') is not True:
        return
    preferences_ready = (
        profile.job_preferences_configured
        and CandidateJobPreference.objects.filter(candidate_profile=profile).exists()
    )
    if not preferences_ready:
        raise ValidationError(
            {
                'code': 'preferences_required',
                'suitable_job_recommendations': (
                    'Hãy hoàn tất cài đặt gợi ý việc làm trước khi bật email phù hợp.'
                ),
            }
        )
    has_consent = CandidateConsent.objects.filter(
        candidate_profile=profile,
        consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
        decision=CandidateConsent.Decision.GRANTED,
    ).exists()
    if not has_consent:
        raise ValidationError(
            {
                'code': 'consent_required',
                'suitable_job_recommendations': (
                    'Bạn cần đồng ý sử dụng dữ liệu hồ sơ cho gợi ý việc làm trước khi bật email.'
                ),
            }
        )


@transaction.atomic
def patch_candidate_email_notification_settings(user, changes):
    """Apply a partial settings update, creating the aggregate on first write."""
    locked_user = lock_account_for_write(user)
    profile, _ = CandidateProfile.objects.select_for_update().get_or_create(user=locked_user)

    settings = (
        CandidateEmailNotificationSettings.objects.select_for_update()
        .filter(candidate_profile=profile)
        .first()
    )
    previous = settings or CandidateEmailNotificationSettings(candidate_profile=profile)
    configured_opted_in = (
        changes.get('configured_job_alerts') is True and not previous.configured_job_alerts
    )
    suitable_opted_in = (
        changes.get('suitable_job_recommendations') is True
        and not previous.suitable_job_recommendations
    )
    if (configured_opted_in or suitable_opted_in) and not locked_user.email_verified:
        raise ValidationError(
            {
                'code': 'email_unverified',
                'detail': 'Hãy xác thực email tài khoản trước khi bật thông báo việc làm.',
            }
        )
    _validate_suitable_recommendation_opt_in(profile, changes)

    if settings is None:
        settings = CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile,
            **changes,
        )
    else:
        for field, value in changes.items():
            setattr(settings, field, value)
        settings.save(update_fields=[*changes, 'updated_at'])

    _reset_delivery_cursors(
        locked_user,
        configured=configured_opted_in,
        suitable=suitable_opted_in,
    )
    return settings
