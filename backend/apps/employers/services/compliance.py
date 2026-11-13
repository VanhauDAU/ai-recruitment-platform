"""Multi-source employer compliance holds and canonical row locking."""

from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.jobs.models import Job
from common.public_id import generate_public_id

from ..models import (
    Company,
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerComplianceHold,
    EmployerComplianceHoldCampaign,
    EmployerComplianceHoldJob,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentCampaign,
    RecruitmentNeed,
)


@dataclass(frozen=True)
class LockedVerificationScope:
    user: User
    recruiter: RecruiterProfile
    case: EmployerVerificationCase
    company: Company | None
    recruitment_needs: tuple[RecruitmentNeed, ...] = ()
    campaigns: tuple[RecruitmentCampaign, ...] = ()
    jobs: tuple[Job, ...] = ()
    documents: tuple[CompanyDocument, ...] = ()
    tax_evidences: tuple[CompanyTaxLookupEvidence, ...] = ()
    holds: tuple[EmployerComplianceHold, ...] = ()
    campaign_links: tuple[EmployerComplianceHoldCampaign, ...] = ()
    job_links: tuple[EmployerComplianceHoldJob, ...] = ()


def lock_verification_identity(case, *, include_resources=False):
    """Lock U → R → V → C and optionally Campaign → Job → hold/link rows.

    The initial identifiers are an optimistic pointer only. Every relationship
    is checked again after the canonical locks are acquired.
    """

    reference = (
        EmployerVerificationCase.objects.filter(pk=case.pk)
        .values('recruiter_id', 'recruiter__user_id')
        .first()
    )
    if reference is None:
        raise ValidationError(
            {'code': 'VERIFICATION_CASE_CHANGED', 'detail': 'Hồ sơ không còn tồn tại.'}
        )
    user = User.objects.select_for_update(of=('self',)).get(pk=reference['recruiter__user_id'])
    recruiter = RecruiterProfile.objects.select_for_update(of=('self',)).get(
        pk=reference['recruiter_id']
    )
    locked_case = EmployerVerificationCase.objects.select_for_update(of=('self',)).get(pk=case.pk)
    if recruiter.user_id != user.pk or locked_case.recruiter_id != recruiter.pk:
        raise ValidationError(
            {
                'code': 'VERIFICATION_CASE_CHANGED',
                'detail': 'Chủ thể hồ sơ đã thay đổi. Vui lòng tải lại.',
            }
        )
    company_rows = tuple(
        Company.objects.select_for_update(of=('self',))
        .filter(
            pk__in={
                company_id
                for company_id in (locked_case.company_id, recruiter.company_id)
                if company_id is not None
            }
        )
        .order_by('pk')
    )
    company = next(
        (item for item in company_rows if item.pk == locked_case.company_id),
        None,
    )
    if not include_resources:
        return LockedVerificationScope(user, recruiter, locked_case, company)

    recruitment_needs = tuple(
        RecruitmentNeed.objects.select_for_update(of=('self',))
        .filter(recruiter_id=recruiter.pk)
        .order_by('pk')
    )
    campaigns = tuple(
        RecruitmentCampaign.objects.select_for_update(of=('self',))
        .filter(owner_id=recruiter.pk)
        .order_by('pk')
    )
    jobs = tuple(
        Job.objects.select_for_update(of=('self',)).filter(posted_by_id=user.pk).order_by('pk')
    )
    documents = tuple(
        CompanyDocument.objects.select_for_update(of=('self',))
        .filter(verification_case_id=locked_case.pk)
        .order_by('pk')
    )
    tax_evidences = tuple(
        CompanyTaxLookupEvidence.objects.select_for_update(of=('self',))
        .filter(verification_case_id=locked_case.pk)
        .order_by('pk')
    )
    holds = tuple(
        EmployerComplianceHold.objects.select_for_update(of=('self',))
        .filter(recruiter_id=recruiter.pk)
        .order_by('pk')
    )
    campaign_links = tuple(
        EmployerComplianceHoldCampaign.objects.select_for_update(of=('self',))
        .filter(
            campaign_id__in=[campaign.pk for campaign in campaigns],
            hold__status=EmployerComplianceHold.Status.ACTIVE,
        )
        .select_related('hold', 'campaign')
        .order_by('pk')
    )
    job_links = tuple(
        EmployerComplianceHoldJob.objects.select_for_update(of=('self',))
        .filter(
            job_id__in=[job.pk for job in jobs],
            hold__status=EmployerComplianceHold.Status.ACTIVE,
        )
        .select_related('hold', 'job')
        .order_by('pk')
    )
    return LockedVerificationScope(
        user=user,
        recruiter=recruiter,
        case=locked_case,
        company=company,
        recruitment_needs=recruitment_needs,
        campaigns=campaigns,
        jobs=jobs,
        documents=documents,
        tax_evidences=tax_evidences,
        holds=holds,
        campaign_links=campaign_links,
        job_links=job_links,
    )


def lock_or_create_verification_identity(recruiter):
    """Lock U → R, safely create/lock V, then lock C for first submission."""

    user = User.objects.select_for_update(of=('self',)).get(pk=recruiter.user_id)
    locked_recruiter = RecruiterProfile.objects.select_for_update(of=('self',)).get(pk=recruiter.pk)
    case = (
        EmployerVerificationCase.objects.select_for_update(of=('self',))
        .filter(recruiter_id=locked_recruiter.pk)
        .first()
    )
    if case is None:
        try:
            with transaction.atomic():
                case = EmployerVerificationCase.objects.create(
                    recruiter=locked_recruiter,
                    company=locked_recruiter.company,
                )
        except IntegrityError:
            # A legacy/non-conforming caller may have won the OneToOne race.
            # Re-read under the case lock instead of leaking the DB exception.
            case = EmployerVerificationCase.objects.select_for_update(of=('self',)).get(
                recruiter_id=locked_recruiter.pk
            )
    company_rows = tuple(
        Company.objects.select_for_update(of=('self',))
        .filter(
            pk__in={
                company_id
                for company_id in (locked_recruiter.company_id, case.company_id)
                if company_id is not None
            }
        )
        .order_by('pk')
    )
    company_id = locked_recruiter.company_id or case.company_id
    company = next((item for item in company_rows if item.pk == company_id), None)
    return LockedVerificationScope(user, locked_recruiter, case, company)


def apply_verification_hold(scope, *, reason, actor):
    """Create/link one verification hold without changing business statuses."""

    if reason not in {
        EmployerComplianceHold.Reason.VERIFICATION_REVOKED,
        EmployerComplianceHold.Reason.VERIFICATION_EXPIRED,
    }:
        raise ValidationError(
            {'code': 'COMPLIANCE_HOLD_REASON_INVALID', 'detail': 'Lý do hold không hợp lệ.'}
        )
    hold = next(
        (
            item
            for item in scope.holds
            if item.status == EmployerComplianceHold.Status.ACTIVE
            and item.source == EmployerComplianceHold.Source.VERIFICATION
        ),
        None,
    )
    if hold is not None and (hold.reason != reason or hold.verification_case_id != scope.case.pk):
        raise ValidationError(
            {
                'code': 'COMPLIANCE_HOLD_SOURCE_CONFLICT',
                'detail': 'Nguồn xác thực đã có một hold đang hoạt động.',
            }
        )
    created = hold is None
    if hold is None:
        hold = EmployerComplianceHold.objects.create(
            recruiter=scope.recruiter,
            verification_case=scope.case,
            source=EmployerComplianceHold.Source.VERIFICATION,
            reason=reason,
            applied_by=actor,
            metadata={
                'case_public_id': scope.case.public_id,
                'case_revision': scope.case.revision,
            },
        )
    EmployerComplianceHoldCampaign.objects.bulk_create(
        [
            EmployerComplianceHoldCampaign(hold=hold, campaign=campaign)
            for campaign in scope.campaigns
        ],
        ignore_conflicts=True,
    )
    EmployerComplianceHoldJob.objects.bulk_create(
        [EmployerComplianceHoldJob(hold=hold, job=job) for job in scope.jobs],
        ignore_conflicts=True,
    )
    return hold, created


def apply_dpa_hold(scope, *, rollout_id, actor=None):
    """Apply the single DPA-source hold and link every current resource."""

    rollout_id = rollout_id.strip()
    if not rollout_id or len(rollout_id) > 64:
        raise ValidationError(
            {'code': 'DPA_ROLLOUT_ID_INVALID', 'detail': 'DPA rollout_id không hợp lệ.'}
        )
    hold = next(
        (
            item
            for item in scope.holds
            if item.status == EmployerComplianceHold.Status.ACTIVE
            and item.source == EmployerComplianceHold.Source.DPA
        ),
        None,
    )
    if hold is not None and (
        hold.reason != EmployerComplianceHold.Reason.DPA_HOLD
        or hold.metadata.get('rollout_id') != rollout_id
    ):
        raise ValidationError(
            {
                'code': 'COMPLIANCE_HOLD_SOURCE_CONFLICT',
                'detail': 'Nguồn DPA đã có một hold khác đang hoạt động.',
            }
        )
    created = hold is None
    if hold is None:
        hold = EmployerComplianceHold.objects.create(
            recruiter=scope.recruiter,
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_HOLD,
            applied_by=actor,
            metadata={
                'rollout_id': rollout_id,
                'grace_expires_at': (
                    scope.recruiter.dpa_grace_expires_at.isoformat()
                    if scope.recruiter.dpa_grace_expires_at
                    else None
                ),
            },
        )
    EmployerComplianceHoldCampaign.objects.bulk_create(
        [
            EmployerComplianceHoldCampaign(hold=hold, campaign=campaign)
            for campaign in scope.campaigns
        ],
        ignore_conflicts=True,
    )
    EmployerComplianceHoldJob.objects.bulk_create(
        [EmployerComplianceHoldJob(hold=hold, job=job) for job in scope.jobs],
        ignore_conflicts=True,
    )
    return hold, created


@transaction.atomic(savepoint=False)
def apply_expired_dpa_holds_batch(recruiter_ids, *, rollout_id, actor=None):
    """Apply DPA holds for a bounded cohort with flat query count."""

    rollout_id = rollout_id.strip()
    if not rollout_id or len(rollout_id) > 64:
        raise ValidationError(
            {'code': 'DPA_ROLLOUT_ID_INVALID', 'detail': 'DPA rollout_id không hợp lệ.'}
        )
    recruiter_ids = sorted(set(recruiter_ids))
    if not recruiter_ids:
        return [], 0
    users = tuple(
        User.objects.select_for_update(of=('self',))
        .filter(recruiter_profile__id__in=recruiter_ids)
        .order_by('pk')
    )
    recruiters = tuple(
        RecruiterProfile.objects.select_for_update(of=('self',))
        .filter(pk__in=recruiter_ids)
        .order_by('pk')
    )
    if len(recruiters) != len(recruiter_ids):
        raise ValidationError(
            {'code': 'DPA_ROLLOUT_COHORT_CHANGED', 'detail': 'Cohort DPA đã thay đổi.'}
        )
    if {user.pk for user in users} != {recruiter.user_id for recruiter in recruiters}:
        raise ValidationError(
            {'code': 'DPA_ROLLOUT_COHORT_CHANGED', 'detail': 'Chủ tài khoản DPA đã thay đổi.'}
        )
    from ..models.readiness import DpaStatus, current_dpa_status

    now = timezone.now()
    recruiters = tuple(
        recruiter
        for recruiter in recruiters
        if recruiter.dpa_grace_rollout_id == rollout_id
        and recruiter.dpa_grace_expires_at
        and recruiter.dpa_grace_expires_at <= now
        and current_dpa_status(recruiter) == DpaStatus.HOLD
    )
    if not recruiters:
        return [], 0
    recruiter_ids = [recruiter.pk for recruiter in recruiters]
    eligible_user_ids = [recruiter.user_id for recruiter in recruiters]
    tuple(
        EmployerVerificationCase.objects.select_for_update(of=('self',))
        .filter(recruiter_id__in=recruiter_ids)
        .order_by('pk')
    )
    campaigns = tuple(
        RecruitmentCampaign.objects.select_for_update(of=('self',))
        .filter(owner_id__in=recruiter_ids)
        .order_by('pk')
    )
    user_to_recruiter = {recruiter.user_id: recruiter.pk for recruiter in recruiters}
    jobs = tuple(
        Job.objects.select_for_update(of=('self',))
        .filter(posted_by_id__in=eligible_user_ids)
        .order_by('pk')
    )
    existing = tuple(
        EmployerComplianceHold.objects.select_for_update(of=('self',))
        .filter(
            recruiter_id__in=recruiter_ids,
            source=EmployerComplianceHold.Source.DPA,
            status=EmployerComplianceHold.Status.ACTIVE,
        )
        .order_by('pk')
    )
    for hold in existing:
        if (
            hold.reason != EmployerComplianceHold.Reason.DPA_HOLD
            or hold.metadata.get('rollout_id') != rollout_id
        ):
            raise ValidationError(
                {
                    'code': 'COMPLIANCE_HOLD_SOURCE_CONFLICT',
                    'detail': f'Recruiter {hold.recruiter_id} có DPA hold khác.',
                }
            )
    hold_by_recruiter = {hold.recruiter_id: hold for hold in existing}
    missing = [recruiter for recruiter in recruiters if recruiter.pk not in hold_by_recruiter]
    created_holds = EmployerComplianceHold.objects.bulk_create(
        [
            EmployerComplianceHold(
                public_id=generate_public_id('ech'),
                recruiter=recruiter,
                source=EmployerComplianceHold.Source.DPA,
                reason=EmployerComplianceHold.Reason.DPA_HOLD,
                applied_by=actor,
                metadata={
                    'rollout_id': rollout_id,
                    'grace_expires_at': recruiter.dpa_grace_expires_at.isoformat(),
                },
            )
            for recruiter in missing
        ]
    )
    hold_by_recruiter.update({hold.recruiter_id: hold for hold in created_holds})
    EmployerComplianceHoldCampaign.objects.bulk_create(
        [
            EmployerComplianceHoldCampaign(
                hold=hold_by_recruiter[campaign.owner_id],
                campaign=campaign,
            )
            for campaign in campaigns
        ],
        ignore_conflicts=True,
    )
    EmployerComplianceHoldJob.objects.bulk_create(
        [
            EmployerComplianceHoldJob(
                hold=hold_by_recruiter[user_to_recruiter[job.posted_by_id]],
                job=job,
            )
            for job in jobs
        ],
        ignore_conflicts=True,
    )
    return list(hold_by_recruiter.values()), len(created_holds)


def release_verification_holds(scope, *, actor, reason):
    """Release only active holds owned by this verification case/source."""

    reason = reason.strip()
    if not reason:
        raise ValidationError(
            {
                'code': 'COMPLIANCE_HOLD_RELEASE_REASON_REQUIRED',
                'detail': 'Cần nhập lý do gỡ compliance hold.',
            }
        )
    active = [
        hold
        for hold in scope.holds
        if hold.status == EmployerComplianceHold.Status.ACTIVE
        and hold.source == EmployerComplianceHold.Source.VERIFICATION
        and hold.verification_case_id == scope.case.pk
    ]
    if not active:
        return []
    now = timezone.now()
    for hold in active:
        hold.status = EmployerComplianceHold.Status.RELEASED
        hold.released_by = actor
        hold.released_at = now
        hold.release_reason = reason
    EmployerComplianceHold.objects.bulk_update(
        active,
        ['status', 'released_by', 'released_at', 'release_reason'],
    )
    return active


def release_dpa_holds(scope, *, actor, reason):
    """Release only the DPA source; verification/account holds remain active."""

    reason = reason.strip()
    if not reason:
        raise ValidationError(
            {
                'code': 'COMPLIANCE_HOLD_RELEASE_REASON_REQUIRED',
                'detail': 'Cần nhập lý do gỡ DPA hold.',
            }
        )
    active = [
        hold
        for hold in scope.holds
        if hold.status == EmployerComplianceHold.Status.ACTIVE
        and hold.source == EmployerComplianceHold.Source.DPA
    ]
    if not active:
        return []
    now = timezone.now()
    for hold in active:
        hold.status = EmployerComplianceHold.Status.RELEASED
        hold.released_by = actor
        hold.released_at = now
        hold.release_reason = reason
    EmployerComplianceHold.objects.bulk_update(
        active,
        ['status', 'released_by', 'released_at', 'release_reason'],
    )
    return active


def recruiter_has_active_compliance_hold(recruiter_id, *, source=None):
    queryset = EmployerComplianceHold.objects.filter(
        recruiter_id=recruiter_id,
        status=EmployerComplianceHold.Status.ACTIVE,
    )
    if source:
        queryset = queryset.filter(source=source)
    return queryset.exists()


__all__ = [
    'LockedVerificationScope',
    'apply_dpa_hold',
    'apply_expired_dpa_holds_batch',
    'apply_verification_hold',
    'lock_verification_identity',
    'lock_or_create_verification_identity',
    'recruiter_has_active_compliance_hold',
    'release_verification_holds',
    'release_dpa_holds',
]
