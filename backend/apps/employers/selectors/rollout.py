"""PII-free operational counters for the employer hardening rollout."""

from django.db.models import Count, Q
from django.utils import timezone

from apps.uploads.models import UploadAsset, UploadSession, UploadTrustStatus

from ..models import (
    Company,
    EmployerComplianceHold,
    EmployerNotification,
    EmployerVerificationCase,
    EmployerVerificationNotification,
    PhoneOtp,
    RecruiterProfile,
)


def employer_rollout_counters():
    """Return aggregate-only rollout evidence; never include account identifiers."""

    now = timezone.now()
    session_states = {
        row['state']: row['count']
        for row in UploadSession.objects.values('state').annotate(count=Count('pk'))
    }
    return {
        'legacy_dpa_acceptances': RecruiterProfile.objects.filter(
            dpa_accepted_at__isnull=False,
        )
        .filter(Q(dpa_policy_version='') | Q(dpa_document_sha256=''))
        .count(),
        'active_legacy_phone_challenges': PhoneOtp.objects.filter(
            purpose=PhoneOtp.Purpose.LEGACY_EMAIL,
            invalidated_at__isnull=True,
            expires_at__gt=now,
        ).count(),
        'legacy_verification_cases': EmployerVerificationCase.objects.filter(
            status=EmployerVerificationCase.Status.APPROVED,
            decision_source__in={
                EmployerVerificationCase.DecisionSource.LEGACY_AUTO,
                EmployerVerificationCase.DecisionSource.LEGACY_UNKNOWN,
            },
        ).count(),
        'legacy_verified_companies': Company.objects.filter(
            verification_status=Company.VerificationStatus.VERIFIED,
            verification_source__in={
                Company.VerificationSource.LEGACY_AUTO,
                Company.VerificationSource.LEGACY_UNKNOWN,
            },
        ).count(),
        'legacy_upload_assets': UploadAsset.objects.filter(
            trust_status=UploadTrustStatus.LEGACY_TRUSTED,
            deleted_at__isnull=True,
        ).count(),
        'upload_sessions_by_state': session_states,
        'active_compliance_holds': EmployerComplianceHold.objects.filter(
            released_at__isnull=True,
        ).count(),
        'verification_email_outbox': {
            row['status']: row['count']
            for row in EmployerVerificationNotification.objects.values('status').annotate(
                count=Count('pk')
            )
        },
        'website_notifications_unread': EmployerNotification.objects.filter(
            read_at__isnull=True,
        ).count(),
    }
