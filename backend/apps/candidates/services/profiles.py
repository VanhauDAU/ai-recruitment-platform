"""Write workflows for candidate profiles and job-search preferences."""

from django.db import transaction
from django.utils import timezone

from ..models import (
    CandidateConsent,
    CandidateConsentEvent,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidateProfile,
)


@transaction.atomic
def set_recruiter_visibility(profile, *, enabled, policy_version, source, source_path='', cv_public_id=''):
    """Update current consent and append an immutable decision audit event."""
    locked_profile = CandidateProfile.objects.select_for_update().get(pk=profile.pk)
    now = timezone.now()
    decision = CandidateConsent.Decision.GRANTED if enabled else CandidateConsent.Decision.DENIED
    consent, _ = CandidateConsent.objects.update_or_create(
        candidate_profile=locked_profile,
        consent_type=CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
        defaults={'decision': decision, 'policy_version': policy_version, 'decided_at': now},
    )
    CandidateConsentEvent.objects.create(
        candidate_profile=locked_profile,
        consent_type=CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
        decision=decision,
        policy_version=policy_version,
        source=source,
        source_path=source_path,
        cv_public_id=cv_public_id,
        decided_at=now,
    )
    return consent


@transaction.atomic
def update_candidate_profile(serializer):
    """Persist a validated candidate profile update through the domain boundary."""
    return serializer.save()


@transaction.atomic
def replace_candidate_job_preferences(profile, validated_data):
    """Atomically replace normalized selections and persist current consents."""
    locked_profile = CandidateProfile.objects.select_for_update().get(pk=profile.pk)
    preference, _ = CandidateJobPreference.objects.select_for_update().get_or_create(
        candidate_profile=locked_profile,
    )
    specializations = validated_data.pop('desired_specialization_ids')
    provinces = validated_data.pop('preferred_province_ids')
    ai_consent = validated_data.pop('ai_recommendation_consent')
    recruiter_consent = validated_data.pop('recruiter_visibility_consent')

    preference.desired_position_other = validated_data['desired_position_other']
    preference.desired_salary_vnd = validated_data.get('desired_salary_vnd')
    preference.experience_level = validated_data['experience_level']
    preference.willing_to_relocate = validated_data.get('willing_to_relocate')
    preference.save()

    CandidateDesiredSpecialization.objects.filter(job_preference=preference).delete()
    CandidateDesiredSpecialization.objects.bulk_create([
        CandidateDesiredSpecialization(job_preference=preference, job_category=category, sort_order=index)
        for index, category in enumerate(specializations)
    ])
    CandidatePreferredProvince.objects.filter(job_preference=preference).delete()
    CandidatePreferredProvince.objects.bulk_create([
        CandidatePreferredProvince(job_preference=preference, location=province, sort_order=index)
        for index, province in enumerate(provinces)
    ])

    now = timezone.now()
    for consent_type, allowed in (
        (CandidateConsent.ConsentType.AI_RECOMMENDATION, ai_consent),
        (CandidateConsent.ConsentType.RECRUITER_VISIBILITY, recruiter_consent),
    ):
        decision = CandidateConsent.Decision.GRANTED if allowed else CandidateConsent.Decision.DENIED
        CandidateConsent.objects.update_or_create(
            candidate_profile=locked_profile,
            consent_type=consent_type,
            defaults={
                'decision': decision,
                'policy_version': 'v1',
                'decided_at': now,
            },
        )
        CandidateConsentEvent.objects.create(
            candidate_profile=locked_profile,
            consent_type=consent_type,
            decision=decision,
            policy_version='v1',
            source='job_preferences',
            decided_at=now,
        )

    if not locked_profile.job_preferences_configured:
        locked_profile.job_preferences_configured = True
        locked_profile.save(update_fields=['job_preferences_configured', 'updated_at'])
    return preference
