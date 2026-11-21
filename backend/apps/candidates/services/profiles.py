"""Write workflows for candidate profiles and job-search preferences."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.cvs.models import UserCv
from apps.cvs.services import withdraw_cvs_from_recruiter_search

from ..models import (
    CandidateConsent,
    CandidateConsentEvent,
    CandidateDesiredPositionOther,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidatePreferredSkill,
    CandidateProfile,
)

# Phiên bản văn bản đồng ý của ứng viên (gợi ý AI, hiển thị hồ sơ cho NTD). Văn bản nằm
# trong mã nguồn nên phiên bản đổi cùng lần triển khai sửa văn bản.
CONSENT_POLICY_VERSION = 'v1'


@transaction.atomic
def set_recruiter_visibility(profile, *, enabled, source, source_path='', cv_public_id=''):
    """Update current consent and append an immutable decision audit event."""
    if (
        cv_public_id
        and not UserCv.objects.filter(
            user_id=profile.user_id, public_id=cv_public_id, is_deleted=False
        ).exists()
    ):
        raise ValidationError({'cv_public_id': 'CV không thuộc tài khoản hiện tại.'})
    locked_profile = CandidateProfile.objects.select_for_update().get(pk=profile.pk)
    consent = _record_consent(
        locked_profile,
        CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
        enabled=enabled,
        source=source,
        source_path=source_path,
        cv_public_id=cv_public_id,
    )
    if not enabled:
        withdraw_cvs_from_recruiter_search(locked_profile.user)
    return consent


@transaction.atomic
def set_ai_recommendation(profile, *, enabled, source, source_path=''):
    """Bật/tắt đồng ý gợi ý việc làm bằng AI, độc lập với nhu cầu công việc.

    Không đổi `job_preferences_configured`: bật gợi ý không có nghĩa là đã khai nhu cầu.
    """
    locked_profile = CandidateProfile.objects.select_for_update().get(pk=profile.pk)
    return _record_consent(
        locked_profile,
        CandidateConsent.ConsentType.AI_RECOMMENDATION,
        enabled=enabled,
        source=source,
        source_path=source_path,
    )


def _record_consent(
    locked_profile,
    consent_type,
    *,
    enabled,
    source,
    source_path='',
    cv_public_id='',
):
    """Ghi quyết định hiện hành và thêm một sự kiện kiểm toán không sửa được.

    Phiên bản chính sách do server gán (``CONSENT_POLICY_VERSION``), không nhận
    từ client, để bản ghi đồng ý kiểm chứng được.
    """
    policy_version = CONSENT_POLICY_VERSION
    now = timezone.now()
    decision = CandidateConsent.Decision.GRANTED if enabled else CandidateConsent.Decision.DENIED
    consent, _ = CandidateConsent.objects.update_or_create(
        candidate_profile=locked_profile,
        consent_type=consent_type,
        defaults={'decision': decision, 'policy_version': policy_version, 'decided_at': now},
    )
    CandidateConsentEvent.objects.create(
        candidate_profile=locked_profile,
        consent_type=consent_type,
        decision=decision,
        policy_version=policy_version,
        source=source,
        source_path=source_path,
        cv_public_id=cv_public_id,
        decided_at=now,
    )
    return consent


@transaction.atomic
def update_candidate_profile(profile, changes):
    """Apply validated profile fields (currently only ``gender``) and save."""
    for field, value in changes.items():
        setattr(profile, field, value)
    profile.save()
    return profile


@transaction.atomic
def replace_candidate_job_preferences(profile, validated_data):
    """Atomically replace normalized selections and persist current consents."""
    validated_data = dict(validated_data)
    locked_profile = CandidateProfile.objects.select_for_update().get(pk=profile.pk)
    preference, _ = CandidateJobPreference.objects.select_for_update().get_or_create(
        candidate_profile=locked_profile,
    )
    specializations = validated_data.pop('desired_specialization_ids')
    custom_positions = validated_data.pop('desired_position_others')
    provinces = validated_data.pop('preferred_province_ids')
    preferred_skills = validated_data.pop('preferred_skill_ids', None)
    ai_consent = validated_data.pop('ai_recommendation_consent')
    recruiter_consent = validated_data.pop('recruiter_visibility_consent')

    preference.desired_position_other = custom_positions[0] if custom_positions else None
    preference.desired_salary_vnd = validated_data.get('desired_salary_vnd')
    preference.experience_level = validated_data['experience_level']
    preference.willing_to_relocate = validated_data.get('willing_to_relocate')
    preference.save()

    CandidateDesiredSpecialization.objects.filter(job_preference=preference).delete()
    CandidateDesiredSpecialization.objects.bulk_create(
        [
            CandidateDesiredSpecialization(
                job_preference=preference, job_category=category, sort_order=index
            )
            for index, category in enumerate(specializations)
        ]
    )
    CandidateDesiredPositionOther.objects.filter(job_preference=preference).delete()
    CandidateDesiredPositionOther.objects.bulk_create(
        [
            CandidateDesiredPositionOther(
                job_preference=preference,
                name=position,
                sort_order=index,
            )
            for index, position in enumerate(custom_positions)
        ]
    )
    CandidatePreferredProvince.objects.filter(job_preference=preference).delete()
    CandidatePreferredProvince.objects.bulk_create(
        [
            CandidatePreferredProvince(
                job_preference=preference, location=province, sort_order=index
            )
            for index, province in enumerate(provinces)
        ]
    )
    # New-field omission is deliberate legacy-client compatibility. Sending an
    # explicit empty list still clears the current preferred-skill selection.
    if preferred_skills is not None:
        CandidatePreferredSkill.objects.filter(job_preference=preference).delete()
        CandidatePreferredSkill.objects.bulk_create(
            [
                CandidatePreferredSkill(
                    job_preference=preference,
                    skill=skill,
                    sort_order=index,
                )
                for index, skill in enumerate(preferred_skills)
            ]
        )

    now = timezone.now()
    for consent_type, allowed in (
        (CandidateConsent.ConsentType.AI_RECOMMENDATION, ai_consent),
        (CandidateConsent.ConsentType.RECRUITER_VISIBILITY, recruiter_consent),
    ):
        decision = (
            CandidateConsent.Decision.GRANTED if allowed else CandidateConsent.Decision.DENIED
        )
        CandidateConsent.objects.update_or_create(
            candidate_profile=locked_profile,
            consent_type=consent_type,
            defaults={
                'decision': decision,
                'policy_version': CONSENT_POLICY_VERSION,
                'decided_at': now,
            },
        )
        CandidateConsentEvent.objects.create(
            candidate_profile=locked_profile,
            consent_type=consent_type,
            decision=decision,
            policy_version=CONSENT_POLICY_VERSION,
            source='job_preferences',
            decided_at=now,
        )
    if not recruiter_consent:
        withdraw_cvs_from_recruiter_search(locked_profile.user)

    if not locked_profile.job_preferences_configured:
        locked_profile.job_preferences_configured = True
        locked_profile.save(update_fields=['job_preferences_configured', 'updated_at'])
    return preference
