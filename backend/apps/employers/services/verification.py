"""Employer-account verification state machine and final decisions."""

import hashlib
import json
import re
import unicodedata

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.permissions import require_admin_permission
from apps.accounts.services import (
    InvalidImpactToken,
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)

from ..models import (
    Company,
    CompanyDocument,
    CompanyTaxLookupEvidence,
    DpaStatus,
    EmployerComplianceHold,
    EmployerComplianceHoldCampaign,
    EmployerComplianceHoldJob,
    EmployerNotification,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    EmployerVerificationNotification,
)
from ..models.readiness import current_dpa_status
from .compliance import (
    LockedVerificationScope,
    apply_verification_hold,
    lock_or_create_verification_identity,
    lock_verification_identity,
    release_verification_holds,
)
from .notifications import emit_employer_event, intermediate_verification_email_enabled
from .tax_lookup import queue_company_tax_lookup

BUSINESS_DOCUMENT_TYPES = frozenset(
    {
        CompanyDocument.DocType.BUSINESS_REGISTRATION,
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    }
)

FINAL_DECISIONS = frozenset(
    {
        EmployerVerificationCase.Status.APPROVED,
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
    }
)
LIFECYCLE_ACTIONS = frozenset(
    {
        EmployerVerificationCase.Status.REVOKED,
        EmployerVerificationCase.Status.EXPIRED,
    }
)
TAX_OVERRIDE_PERMISSION = 'employer_verification.tax_override'
VERIFICATION_REVOKE_PERMISSION = 'employer_verification.revoke'
VERIFICATION_RESUBMISSION_UNLOCK_PERMISSION = 'employer_verification.resubmission_unlock'
MAX_FINAL_REJECTIONS = 3


def _workflow_error(code, detail, **extra):
    raise ValidationError({'code': code, 'detail': detail, **extra})


def _normalized_legal_text(value):
    value = unicodedata.normalize('NFKD', str(value or ''))
    value = ''.join(char for char in value if not unicodedata.combining(char))
    value = value.replace('đ', 'd').replace('Đ', 'D').upper()
    return ' '.join(re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE).split())


def _timestamp_marker(value):
    return value.isoformat(timespec='microseconds') if value else None


def _privacy_safe_hash(value):
    return hashlib.sha256(str(value or '').encode()).hexdigest()


def _prefetched_rows(instance, relation_name, *, ordering=('pk',)):
    cached = getattr(instance, '_prefetched_objects_cache', {}).get(relation_name)
    if cached is not None:
        return tuple(cached)
    return tuple(getattr(instance, relation_name).order_by(*ordering))


def _verification_snapshot_scope(case):
    """Load every impact input once so preview query count stays resource-flat."""

    recruiter = case.recruiter
    user = recruiter.user
    # Company legal identity is an independently mutable business row. Do not
    # reuse a relation cache from an earlier preview: tax evidence and the
    # signed fingerprint must always be compared with the current row.
    company = Company.objects.get(pk=case.company_id) if case.company_id else None
    if company is not None:
        case._state.fields_cache['company'] = company
    recruitment_needs = getattr(recruiter, 'verification_recruitment_needs', None)
    if recruitment_needs is None:
        recruitment_needs = _prefetched_rows(recruiter, 'recruitment_needs')
    else:
        recruitment_needs = tuple(recruitment_needs)
    campaigns = _prefetched_rows(recruiter, 'campaigns')
    jobs = _prefetched_rows(user, 'posted_jobs')
    documents = _prefetched_rows(case, 'documents')
    tax_evidences = _prefetched_rows(
        case,
        'tax_lookup_evidences',
        ordering=('-created_at', '-id'),
    )
    holds = tuple(EmployerComplianceHold.objects.filter(recruiter_id=recruiter.pk).order_by('pk'))
    campaign_links = tuple(
        EmployerComplianceHoldCampaign.objects.filter(
            campaign_id__in=[campaign.pk for campaign in campaigns],
            hold__status=EmployerComplianceHold.Status.ACTIVE,
        )
        .select_related('hold', 'campaign')
        .order_by('pk')
    )
    job_links = tuple(
        EmployerComplianceHoldJob.objects.filter(
            job_id__in=[job.pk for job in jobs],
            hold__status=EmployerComplianceHold.Status.ACTIVE,
        )
        .select_related('hold', 'job')
        .order_by('pk')
    )
    return LockedVerificationScope(
        user=user,
        recruiter=recruiter,
        case=case,
        company=company,
        recruitment_needs=tuple(recruitment_needs),
        campaigns=campaigns,
        jobs=jobs,
        documents=documents,
        tax_evidences=tax_evidences,
        holds=holds,
        campaign_links=campaign_links,
        job_links=job_links,
    )


def _integrity_fingerprint(case, *, scope=None):
    """Fingerprint every row whose same-count replacement can stale a preview."""

    recruiter = scope.recruiter if scope else case.recruiter
    user = scope.user if scope else recruiter.user
    company = scope.company if scope else (case.company if case.company_id else None)
    needs = scope.recruitment_needs if scope else tuple(recruiter.recruitment_needs.order_by('pk'))
    campaigns = scope.campaigns if scope else tuple(recruiter.campaigns.order_by('pk'))
    jobs = scope.jobs if scope else tuple(user.posted_jobs.order_by('pk'))
    documents = scope.documents if scope else tuple(case.documents.order_by('pk'))
    tax_evidences = (
        scope.tax_evidences if scope else tuple(case.tax_lookup_evidences.order_by('pk'))
    )
    holds = (
        scope.holds
        if scope
        else tuple(EmployerComplianceHold.objects.filter(recruiter=recruiter).order_by('pk'))
    )
    # Preview may reuse prefetched relations while confirm reloads and locks the
    # same rows in canonical PK order. Normalize every collection before
    # hashing so order alone never invalidates an otherwise unchanged impact.
    needs = tuple(sorted(needs, key=lambda item: item.pk))
    campaigns = tuple(sorted(campaigns, key=lambda item: item.pk))
    jobs = tuple(sorted(jobs, key=lambda item: item.pk))
    documents = tuple(sorted(documents, key=lambda item: item.pk))
    tax_evidences = tuple(sorted(tax_evidences, key=lambda item: item.pk))
    holds = tuple(sorted(holds, key=lambda item: item.pk))
    active_holds = [hold for hold in holds if hold.status == EmployerComplianceHold.Status.ACTIVE]
    campaign_ids = [campaign.pk for campaign in campaigns]
    job_ids = [job.pk for job in jobs]
    if scope:
        campaign_links = scope.campaign_links
        job_links = scope.job_links
    else:
        campaign_links = []
        job_links = []
        if campaign_ids:
            campaign_links = list(
                EmployerComplianceHoldCampaign.objects.filter(
                    campaign_id__in=campaign_ids,
                    hold__status=EmployerComplianceHold.Status.ACTIVE,
                )
                .select_related('hold', 'campaign')
                .order_by('pk')
            )
        if job_ids:
            job_links = list(
                EmployerComplianceHoldJob.objects.filter(
                    job_id__in=job_ids,
                    hold__status=EmployerComplianceHold.Status.ACTIVE,
                )
                .select_related('hold', 'job')
                .order_by('pk')
            )
    campaign_links = tuple(sorted(campaign_links, key=lambda item: item.pk))
    job_links = tuple(sorted(job_links, key=lambda item: item.pk))
    context = {
        'case': [
            case.public_id,
            case.status,
            case.revision,
            case.lock_version,
            case.final_rejection_count,
            _timestamp_marker(case.resubmission_locked_at),
            _timestamp_marker(case.updated_at),
        ],
        'user': [
            user.public_id,
            user.status,
            user.email_verified,
            _timestamp_marker(user.updated_at),
        ],
        'recruiter': [
            recruiter.public_id,
            recruiter.company_id,
            _timestamp_marker(recruiter.registration_completed_at),
            _timestamp_marker(recruiter.phone_verified_at),
            _timestamp_marker(recruiter.dpa_accepted_at),
            _timestamp_marker(recruiter.updated_at),
        ],
        'dpa_acceptance_pointer': [
            recruiter.dpa_policy_version,
            recruiter.dpa_document_sha256,
            _timestamp_marker(recruiter.dpa_accepted_at),
        ],
        'company': (
            [
                company.public_id,
                _privacy_safe_hash(company.tax_code),
                _privacy_safe_hash(company.company_name),
                _timestamp_marker(company.updated_at),
            ]
            if company
            else None
        ),
        'needs': [
            [
                need.public_id,
                need.is_active,
                _timestamp_marker(need.completed_at),
                _timestamp_marker(need.updated_at),
            ]
            for need in needs
        ],
        'campaigns': [
            [
                campaign.public_id,
                campaign.status,
                campaign.policy_hold,
                _timestamp_marker(campaign.updated_at),
            ]
            for campaign in campaigns
        ],
        'jobs': [
            [
                job.public_id,
                job.status,
                job.policy_hold,
                job.moderation_hold,
                job.campaign_id,
                _timestamp_marker(job.updated_at),
            ]
            for job in jobs
        ],
        'documents': [
            [
                document.public_id,
                document.doc_type,
                document.version,
                document.is_current,
                document.status,
                _privacy_safe_hash(document.sha256),
                _timestamp_marker(document.updated_at),
            ]
            for document in documents
        ],
        'tax_evidences': [
            [
                evidence.public_id,
                evidence.workflow_revision,
                evidence.status,
                evidence.response_hash,
                _timestamp_marker(evidence.updated_at),
            ]
            for evidence in tax_evidences
        ],
        'active_holds': [
            [hold.public_id, hold.source, hold.reason, _timestamp_marker(hold.applied_at)]
            for hold in active_holds
        ],
        'campaign_links': [
            [
                link.hold.public_id,
                link.hold.source,
                link.hold.reason,
                link.campaign.public_id,
                _timestamp_marker(link.linked_at),
            ]
            for link in campaign_links
        ],
        'job_links': [
            [
                link.hold.public_id,
                link.hold.source,
                link.hold.reason,
                link.job.public_id,
                _timestamp_marker(link.linked_at),
            ]
            for link in job_links
        ],
    }
    encoded = json.dumps(context, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(encoded).hexdigest()


def _resource_rows(case, *, scope=None):
    recruiter = scope.recruiter if scope else case.recruiter
    jobs = scope.jobs if scope else tuple(recruiter.user.posted_jobs.order_by('pk'))
    campaigns = scope.campaigns if scope else tuple(recruiter.campaigns.order_by('pk'))
    holds = (
        scope.holds
        if scope
        else tuple(EmployerComplianceHold.objects.filter(recruiter=recruiter).order_by('pk'))
    )
    return recruiter, jobs, campaigns, holds


def _active_resource_hold_ids(*, jobs, campaigns, scope=None, ignored_hold_ids=()):
    ignored_hold_ids = set(ignored_hold_ids)
    if scope:
        return (
            {
                link.job_id
                for link in scope.job_links
                if link.hold.status == EmployerComplianceHold.Status.ACTIVE
                and link.hold_id not in ignored_hold_ids
            },
            {
                link.campaign_id
                for link in scope.campaign_links
                if link.hold.status == EmployerComplianceHold.Status.ACTIVE
                and link.hold_id not in ignored_hold_ids
            },
        )
    job_links = EmployerComplianceHoldJob.objects.filter(
        job_id__in=[job.pk for job in jobs],
        hold__status=EmployerComplianceHold.Status.ACTIVE,
    ).exclude(hold_id__in=ignored_hold_ids)
    campaign_links = EmployerComplianceHoldCampaign.objects.filter(
        campaign_id__in=[campaign.pk for campaign in campaigns],
        hold__status=EmployerComplianceHold.Status.ACTIVE,
    ).exclude(hold_id__in=ignored_hold_ids)
    return set(job_links.values_list('job_id', flat=True)), set(
        campaign_links.values_list('campaign_id', flat=True)
    )


def _public_job_ids(case, *, scope=None, ignored_hold_ids=()):
    """Mirror the canonical public predicate for a bounded recruiter resource set."""

    recruiter, jobs, campaigns, _ = _resource_rows(case, scope=scope)
    held_job_ids, held_campaign_ids = _active_resource_hold_ids(
        jobs=jobs,
        campaigns=campaigns,
        scope=scope,
        ignored_hold_ids=ignored_hold_ids,
    )
    campaign_by_id = {campaign.pk: campaign for campaign in campaigns}
    if not (
        recruiter.user.status == 'active'
        and recruiter.user.is_active
        and not recruiter.user.is_deleted
        and recruiter.company_id == case.company_id
    ):
        return set()
    today = timezone.localdate()
    visible = set()
    for job in jobs:
        if (
            job.pk in held_job_ids
            or job.company_id != recruiter.company_id
            or job.status != 'active'
            or job.policy_hold
            or job.moderation_hold
            or (job.deadline is not None and job.deadline < today)
        ):
            continue
        if job.campaign_id is not None:
            campaign = campaign_by_id.get(job.campaign_id)
            if (
                campaign is None
                or campaign.pk in held_campaign_ids
                or campaign.status != 'active'
                or campaign.policy_hold
            ):
                continue
        visible.add(job.pk)
    return visible


def _verification_hold_impact(case, *, scope=None):
    _, jobs, campaigns, holds = _resource_rows(case, scope=scope)
    hold_ids = [
        hold.pk
        for hold in holds
        if hold.status == EmployerComplianceHold.Status.ACTIVE
        and hold.source == EmployerComplianceHold.Source.VERIFICATION
        and hold.verification_case_id == case.pk
    ]
    if not hold_ids:
        return {
            'hold_count': 0,
            'campaign_count': 0,
            'job_count': 0,
            'active_jobs_to_unhide': 0,
        }
    if scope:
        campaign_ids = {
            link.campaign_id for link in scope.campaign_links if link.hold_id in hold_ids
        }
        job_ids = {link.job_id for link in scope.job_links if link.hold_id in hold_ids}
    else:
        campaign_ids = set(
            EmployerComplianceHoldCampaign.objects.filter(hold_id__in=hold_ids).values_list(
                'campaign_id', flat=True
            )
        )
        job_ids = set(
            EmployerComplianceHoldJob.objects.filter(hold_id__in=hold_ids).values_list(
                'job_id', flat=True
            )
        )
    affected_job_ids = job_ids | {job.pk for job in jobs if job.campaign_id in campaign_ids}
    active_job_count = len(
        affected_job_ids & _public_job_ids(case, scope=scope, ignored_hold_ids=hold_ids)
    )
    return {
        'hold_count': len(hold_ids),
        'campaign_count': len(campaign_ids),
        'job_count': len(job_ids),
        'active_jobs_to_unhide': active_job_count,
    }


def _queue_verification_notification(case, *, event_type, reason=''):
    dedupe_key = f'verification:{case.public_id}:{case.lock_version}:{event_type}'
    website_event_type = {
        'approved': EmployerNotification.EventType.VERIFICATION_APPROVED,
        'changes_requested': EmployerNotification.EventType.VERIFICATION_CHANGES_REQUESTED,
        'rejected': EmployerNotification.EventType.VERIFICATION_REJECTED,
        'revoked': EmployerNotification.EventType.VERIFICATION_REVOKED,
        'expired': EmployerNotification.EventType.VERIFICATION_EXPIRED,
        'document_changes_requested': (EmployerNotification.EventType.DOCUMENT_CHANGES_REQUESTED),
        'document_rejected': EmployerNotification.EventType.DOCUMENT_REJECTED,
    }.get(event_type)
    if website_event_type:
        emit_employer_event(
            recipient=case.recruiter.user,
            event_type=website_event_type,
            dedupe_key=dedupe_key,
            message=reason,
            subject_public_id=case.public_id,
            metadata={'case_public_id': case.public_id, 'status': case.status},
        )
    if event_type.startswith('document_') and not intermediate_verification_email_enabled(
        case.recruiter.user
    ):
        return None
    job, _ = EmployerVerificationNotification.objects.get_or_create(
        recipient=case.recruiter.user,
        dedupe_key=dedupe_key,
        defaults={
            'verification_case': case,
            'event_type': event_type,
            'context': {
                'case_public_id': case.public_id,
                'reason': reason.strip(),
            },
        },
    )

    def dispatch():
        from ..tasks import deliver_employer_verification_notification

        try:
            deliver_employer_verification_notification.delay(job.pk)
        except Exception:  # noqa: BLE001 - persisted row is retried by the sweep
            return

    transaction.on_commit(dispatch)
    return job


@transaction.atomic
def get_or_create_verification_case(recruiter):
    scope = lock_or_create_verification_identity(recruiter)
    recruiter = scope.recruiter
    case = scope.case
    if case.company_id != recruiter.company_id:
        if case.company_id is not None or recruiter.company_id is None:
            _workflow_error(
                'VERIFICATION_COMPANY_RELINK_REQUIRES_REVIEW',
                'Không thể tự chuyển hồ sơ xác thực sang công ty khác.',
            )
        case.company = scope.company
        case.status = EmployerVerificationCase.Status.DRAFT
        case.verification_method = ''
        case.revision += 1
        case.lock_version += 1
        case.decision_source = ''
        case.decision_snapshot = {}
        case.tax_override_reason = ''
        case.tax_override_by = None
        case.save(
            update_fields=[
                'company',
                'status',
                'verification_method',
                'revision',
                'lock_version',
                'decision_source',
                'decision_snapshot',
                'tax_override_reason',
                'tax_override_by',
                'updated_at',
            ]
        )
    return case


def required_document_types(case):
    if case.verification_method == EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID:
        business = {
            CompanyDocument.DocType.AUTHORIZATION_LETTER,
            CompanyDocument.DocType.IDENTITY_DOCUMENT,
        }
    else:
        business = {CompanyDocument.DocType.BUSINESS_REGISTRATION}
    return business | {CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT}


def verification_checks(case):
    recruiter = case.recruiter
    documents = getattr(case, 'current_documents_for_checks', None)
    if documents is None:
        prefetched_documents = getattr(case, '_prefetched_objects_cache', {}).get('documents')
        documents = (
            [document for document in prefetched_documents if document.is_current]
            if prefetched_documents is not None
            else case.documents.filter(is_current=True)
        )
    current_documents = {}
    for document in documents:
        current_documents.setdefault(document.doc_type, []).append(document)
    recruitment_needs = getattr(recruiter, 'verification_recruitment_needs', None)
    consulting_need_completed = (
        bool(recruitment_needs)
        if recruitment_needs is not None
        else recruiter.recruitment_needs.exists()
    )
    required = required_document_types(case)
    business_required = required & BUSINESS_DOCUMENT_TYPES
    return {
        'email_verified': recruiter.user.email_verified,
        'registration_completed': recruiter.registration_completed_at is not None,
        'consulting_need_completed': consulting_need_completed,
        'phone_verified': recruiter.phone_verified_at is not None,
        'company_linked': recruiter.company_id is not None
        and case.company_id == recruiter.company_id,
        'representative_documents_submitted': business_required.issubset(current_documents),
        'business_documents_approved': all(
            current_documents.get(doc_type)
            and all(
                document.status == CompanyDocument.Status.APPROVED
                for document in current_documents[doc_type]
            )
            for doc_type in business_required
        ),
        'candidate_dpa_submitted': (
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT in current_documents
        ),
        'candidate_dpa_approved': (
            bool(current_documents.get(CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT))
            and all(
                document.status == CompanyDocument.Status.APPROVED
                for document in current_documents[CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT]
            )
        ),
        'dpa_accepted': current_dpa_status(recruiter) == DpaStatus.CURRENT,
        'case_approved': case.status == EmployerVerificationCase.Status.APPROVED,
    }


def verification_can_be_approved(case):
    checks = verification_checks(case)
    required = {
        'email_verified',
        'registration_completed',
        'consulting_need_completed',
        'phone_verified',
        'company_linked',
        'representative_documents_submitted',
        'business_documents_approved',
        'candidate_dpa_submitted',
        'candidate_dpa_approved',
        'dpa_accepted',
    }
    return all(checks[key] for key in required), checks


def recruiter_is_approved(recruiter):
    try:
        return recruiter.verification_case.status == EmployerVerificationCase.Status.APPROVED
    except EmployerVerificationCase.DoesNotExist:
        return False


def recruiter_requires_approved_verification():
    return bool(getattr(settings, 'REQUIRE_APPROVED_EMPLOYER_VERIFICATION', False))


def _current_document_issue(case, *, documents=None):
    current_documents = (
        [document for document in documents if document.is_current]
        if documents is not None
        else list(case.documents.filter(is_current=True))
    )
    rejected = next(
        (
            document
            for document in sorted(
                current_documents,
                key=lambda item: (
                    item.reviewed_at or item.updated_at,
                    item.updated_at,
                    item.pk,
                ),
                reverse=True,
            )
            if document.status == CompanyDocument.Status.REJECTED
        ),
        None,
    )
    if rejected is not None:
        return EmployerVerificationCase.Status.REJECTED, rejected.review_note
    changes_requested = next(
        (
            document
            for document in sorted(
                current_documents,
                key=lambda item: (
                    item.reviewed_at or item.updated_at,
                    item.updated_at,
                    item.pk,
                ),
                reverse=True,
            )
            if document.status == CompanyDocument.Status.CHANGES_REQUESTED
        ),
        None,
    )
    if changes_requested is not None:
        return (
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
            changes_requested.review_note,
        )
    return None, ''


@transaction.atomic
def record_verification_upload(
    *,
    recruiter,
    document,
    verification_method='',
):
    case = get_or_create_verification_case(recruiter)
    if case.resubmission_locked_at is not None:
        _workflow_error(
            'VERIFICATION_RESUBMISSION_LOCKED',
            'Hồ sơ đã hết lượt nộp lại. Vui lòng gửi khiếu nại để được quản trị viên xem xét.',
            final_rejection_count=case.final_rejection_count,
            rejection_limit=MAX_FINAL_REJECTIONS,
        )
    locked_documents = tuple(
        CompanyDocument.objects.select_for_update(of=('self',))
        .filter(Q(verification_case_id=case.pk) | Q(pk=document.pk))
        .order_by('pk')
    )
    document = next((item for item in locked_documents if item.pk == document.pk), None)
    if document is None:
        _workflow_error(
            'VERIFICATION_DOCUMENT_CHANGED',
            'Giấy tờ không còn thuộc hồ sơ xác thực.',
        )
    if (
        document.verification_case_id not in {None, case.pk}
        or (document.recruiter_id is not None and document.recruiter_id != case.recruiter_id)
        or (document.company_id is not None and document.company_id != case.company_id)
    ):
        _workflow_error(
            'VERIFICATION_DOCUMENT_SCOPE_INVALID',
            'Giấy tờ không thuộc nhà tuyển dụng hoặc công ty của hồ sơ.',
        )
    if verification_method:
        case.verification_method = verification_method
    elif (
        not case.verification_method
        and document.doc_type == CompanyDocument.DocType.BUSINESS_REGISTRATION
    ):
        case.verification_method = EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION

    terminal_resubmission = case.status in {
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
        EmployerVerificationCase.Status.REVOKED,
        EmployerVerificationCase.Status.EXPIRED,
    }
    issue_status, _ = _current_document_issue(
        case,
        documents=locked_documents,
    )
    resubmission_ready = terminal_resubmission and issue_status is None
    if not terminal_resubmission or resubmission_ready:
        case.status = EmployerVerificationCase.Status.PENDING
        case.submitted_at = timezone.now()
        case.review_started_at = None
        case.decided_at = None
        case.decision_reason = ''
        case.reviewer = None
        case.decision_source = ''
        case.decision_snapshot = {}
        case.tax_override_reason = ''
        case.tax_override_by = None
    case.lock_version += 1
    if resubmission_ready:
        case.revision += 1
    case.save(
        update_fields=[
            'company',
            'verification_method',
            'status',
            'submitted_at',
            'review_started_at',
            'decided_at',
            'decision_reason',
            'reviewer',
            'lock_version',
            'revision',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by',
            'updated_at',
        ]
    )
    if document.verification_case_id != case.pk:
        document.verification_case = case
        document.save(update_fields=['verification_case', 'updated_at'])
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=recruiter.user,
        event_type=(
            EmployerVerificationEvent.EventType.RESUBMITTED
            if resubmission_ready
            else (
                EmployerVerificationEvent.EventType.DOCUMENT_REPLACED
                if terminal_resubmission
                else EmployerVerificationEvent.EventType.SUBMITTED
            )
        ),
        payload={
            'document_public_id': document.public_id,
            'doc_type': document.doc_type,
            'revision': case.revision,
            'resubmission_ready': resubmission_ready,
            'remaining_document_issue': issue_status or '',
        },
    )
    if (
        case.company_id
        and case.company.tax_code
        and not case.tax_lookup_evidences.filter(workflow_revision=case.revision).exists()
    ):
        try:
            queue_company_tax_lookup(
                company=case.company,
                requested_by=recruiter.user,
                verification_case=case,
                workflow_revision=case.revision,
            )
        except ValueError:
            # Legacy companies may contain a pre-validation tax code. Their
            # documents still enter manual review without an external lookup.
            pass
    return case


@transaction.atomic
def start_verification_review(case, *, actor):
    require_admin_permission(actor, 'employer_verification.review')
    case = lock_verification_identity(case).case
    if case.status not in {
        EmployerVerificationCase.Status.PENDING,
        EmployerVerificationCase.Status.IN_REVIEW,
    }:
        _workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Chỉ hồ sơ đang chờ mới có thể bắt đầu xử lý.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.PENDING],
        )
    if case.status != EmployerVerificationCase.Status.IN_REVIEW:
        case.status = EmployerVerificationCase.Status.IN_REVIEW
        case.reviewer = actor
        case.review_started_at = timezone.now()
        case.lock_version += 1
        case.save(
            update_fields=[
                'status',
                'reviewer',
                'review_started_at',
                'lock_version',
                'updated_at',
            ]
        )
        EmployerVerificationEvent.objects.create(
            verification_case=case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.REVIEW_STARTED,
        )
    return case


@transaction.atomic
def review_verification_document(document, *, actor, decision, reason, lock_version):
    require_admin_permission(actor, 'employer_verification.review')
    if document.verification_case_id is None:
        _workflow_error(
            'VERIFICATION_DOCUMENT_NOT_ATTACHED',
            'Giấy tờ không thuộc hồ sơ xác thực.',
        )
    scope = lock_verification_identity(EmployerVerificationCase(pk=document.verification_case_id))
    case = scope.case
    document = CompanyDocument.objects.select_for_update(of=('self',)).get(pk=document.pk)
    if document.verification_case_id != case.pk or not document.is_current:
        _workflow_error(
            'VERIFICATION_DOCUMENT_CHANGED',
            'Giấy tờ đã thay đổi. Vui lòng tải lại.',
        )
    if case.lock_version != lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi. Vui lòng tải lại.')
    if case.status != EmployerVerificationCase.Status.IN_REVIEW:
        _workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Chỉ được xử lý giấy tờ khi hồ sơ đang được review.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.IN_REVIEW],
        )
    if decision not in {
        CompanyDocument.Status.APPROVED,
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }:
        raise ValidationError('Kết quả xử lý giấy tờ không hợp lệ.')
    if decision != CompanyDocument.Status.APPROVED and not reason.strip():
        raise ValidationError('Cần nhập lý do khi yêu cầu bổ sung hoặc từ chối.')
    normalized_reason = '' if decision == CompanyDocument.Status.APPROVED else reason.strip()
    document.status = decision
    document.reviewed_by = actor
    document.reviewed_at = timezone.now()
    document.review_note = normalized_reason
    document.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at']
    )
    case.reviewer = actor
    case.review_started_at = case.review_started_at or timezone.now()
    case.lock_version += 1
    case.save(
        update_fields=[
            'reviewer',
            'review_started_at',
            'lock_version',
            'updated_at',
        ]
    )
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=EmployerVerificationEvent.EventType.DOCUMENT_REVIEWED,
        payload={
            'document_public_id': document.public_id,
            'doc_type': document.doc_type,
            'decision': decision,
            'reason': normalized_reason,
            'case_status': EmployerVerificationCase.Status.IN_REVIEW,
        },
    )
    record_admin_action(
        actor=actor,
        action='review_employer_verification_document',
        target_type='employer_verification_document',
        target_public_id=document.public_id,
        payload={
            'decision': decision,
            'reason': normalized_reason,
            'case_public_id': case.public_id,
            'tax_lookup_evidence_public_id': (
                case.tax_lookup_evidences.filter(workflow_revision=case.revision)
                .order_by('-created_at', '-id')
                .values_list('public_id', flat=True)
                .first()
            ),
        },
    )
    if decision in {
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }:
        _queue_verification_notification(
            case,
            event_type=f'document_{decision}',
            reason=reason,
        )
    return document, case


@transaction.atomic
def reconcile_verification_case(case, *, source='reconciliation'):
    """Compatibility hook that deliberately never makes a final decision.

    Prerequisite changes may make the case eligible for an administrator's
    explicit decision, but ER-D14 forbids this hook from approving the case.
    ``source`` remains accepted so old callers can migrate without a
    risky all-at-once contract change.
    """

    del source
    return lock_verification_identity(case).case, False


def reconcile_recruiter_verification(recruiter, *, source):
    """Re-check the recruiter's existing case after a prerequisite changes."""
    case = EmployerVerificationCase.objects.filter(recruiter=recruiter).first()
    if case is None:
        return None, False
    return reconcile_verification_case(case, source=source)


def reconcile_completed_verification_cases():
    """Deprecated compatibility hook; auto-approval is permanently disabled."""

    return []


def _tax_advisory(case, *, evidences=None):
    if evidences is None:
        evidence = (
            CompanyTaxLookupEvidence.objects.filter(
                verification_case=case,
                workflow_revision=case.revision,
            )
            .order_by('-created_at', '-id')
            .first()
        )
    else:
        evidence = next(
            (
                item
                for item in sorted(
                    evidences,
                    key=lambda item: (item.created_at, item.pk),
                    reverse=True,
                )
                if item.workflow_revision == case.revision
            ),
            None,
        )
    if evidence is None:
        return {
            'status': 'missing',
            'provider_status': None,
            'evidence_public_id': None,
            'comparison': {'tax_code': 'unavailable', 'company_name': 'unavailable'},
            'requires_override': True,
        }
    company = case.company if case.company_id else None
    if company is None or (
        evidence.tax_code != (company.tax_code or '')
        or _normalized_legal_text(evidence.submitted_company_name)
        != _normalized_legal_text(company.company_name)
    ):
        return {
            'status': 'invalid',
            'provider_status': evidence.status,
            'evidence_public_id': evidence.public_id,
            'comparison': {
                'tax_code': 'stale_input',
                'company_name': 'stale_input',
            },
            'requires_override': True,
        }
    if evidence.status == CompanyTaxLookupEvidence.Status.PENDING:
        status = 'pending'
        comparison = {'tax_code': 'pending', 'company_name': 'pending'}
    elif evidence.status == CompanyTaxLookupEvidence.Status.FOUND:
        comparison = {
            'tax_code': 'match' if evidence.tax_code == evidence.returned_tax_code else 'mismatch',
            'company_name': (
                'match'
                if _normalized_legal_text(evidence.submitted_company_name)
                == _normalized_legal_text(evidence.registered_name)
                else 'mismatch'
            ),
        }
        status = 'matched' if set(comparison.values()) == {'match'} else 'mismatch'
    elif evidence.status == CompanyTaxLookupEvidence.Status.NOT_FOUND:
        status = 'not_found'
        comparison = {'tax_code': 'unavailable', 'company_name': 'unavailable'}
    elif evidence.status == CompanyTaxLookupEvidence.Status.UNAVAILABLE:
        status = 'unavailable'
        comparison = {'tax_code': 'unavailable', 'company_name': 'unavailable'}
    else:
        status = 'invalid'
        comparison = {'tax_code': 'unavailable', 'company_name': 'unavailable'}
    return {
        'status': status,
        'provider_status': evidence.status,
        'evidence_public_id': evidence.public_id,
        'comparison': comparison,
        'requires_override': status in {'mismatch', 'not_found', 'unavailable', 'invalid'},
    }


def _prepare_final_decision(
    case,
    *,
    actor,
    decision,
    reason,
    tax_override=False,
    tax_override_reason='',
    scope=None,
    enforce_current_state=True,
):
    require_admin_permission(actor, 'employer_verification.review')
    scope = scope or _verification_snapshot_scope(case)
    if decision not in FINAL_DECISIONS:
        _workflow_error(
            'VERIFICATION_DECISION_INVALID',
            'Kết quả xử lý hồ sơ không hợp lệ.',
        )
    if enforce_current_state and case.status != EmployerVerificationCase.Status.IN_REVIEW:
        _workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Quyết định cuối chỉ áp dụng cho hồ sơ đang được review.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.IN_REVIEW],
        )
    reason = reason.strip()
    if decision != EmployerVerificationCase.Status.APPROVED and not reason:
        _workflow_error(
            'VERIFICATION_REASON_REQUIRED',
            'Cần nhập lý do khi yêu cầu bổ sung hoặc từ chối.',
        )
    case._state.fields_cache['recruiter'] = scope.recruiter
    if scope.company is not None:
        case._state.fields_cache['company'] = scope.company
    case.current_documents_for_checks = [
        document for document in scope.documents if document.is_current
    ]
    scope.recruiter.verification_recruitment_needs = list(scope.recruitment_needs)
    can_approve, checks = verification_can_be_approved(case)
    if (
        enforce_current_state
        and decision == EmployerVerificationCase.Status.APPROVED
        and not can_approve
    ):
        missing = [key for key, value in checks.items() if not value and key != 'case_approved']
        _workflow_error(
            'VERIFICATION_REQUIREMENTS_INCOMPLETE',
            'Hồ sơ chưa đủ điều kiện để duyệt.',
            missing_requirements=missing,
        )

    tax = _tax_advisory(case, evidences=scope.tax_evidences)
    effective_override = bool(
        decision == EmployerVerificationCase.Status.APPROVED
        and tax['requires_override']
        and tax_override
    )
    normalized_override_reason = tax_override_reason.strip() if effective_override else ''
    if decision == EmployerVerificationCase.Status.APPROVED:
        if enforce_current_state and tax['status'] == 'pending':
            _workflow_error(
                'TAX_LOOKUP_PENDING',
                'Đang chờ kết quả tra cứu mã số thuế.',
            )
        if enforce_current_state and tax['requires_override'] and not effective_override:
            _workflow_error(
                'TAX_OVERRIDE_REQUIRED',
                'Kết quả tra cứu thuế cần quyền override và lý do.',
                tax_status=tax['status'],
            )
        if effective_override:
            require_admin_permission(actor, TAX_OVERRIDE_PERMISSION)
            if not normalized_override_reason:
                _workflow_error(
                    'TAX_OVERRIDE_REASON_REQUIRED',
                    'Cần nhập lý do override kết quả tra cứu thuế.',
                )
    hold_impact = _verification_hold_impact(case, scope=scope)
    snapshot = {
        'case_public_id': case.public_id,
        'case_revision': case.revision,
        'lock_version': case.lock_version,
        'decision': decision,
        'reason': reason,
        'checks': checks,
        'tax_advisory': tax,
        'tax_override': effective_override,
        'tax_override_reason': normalized_override_reason,
        'capability_impact': {
            'candidate_data_access': (
                'eligible_after_recompute'
                if decision == EmployerVerificationCase.Status.APPROVED
                else 'blocked'
            ),
            'job_approval': (
                'eligible_after_recompute'
                if decision == EmployerVerificationCase.Status.APPROVED
                else 'blocked'
            ),
            'job_workspace': 'unchanged',
        },
        'verification_hold_impact': (
            hold_impact
            if decision == EmployerVerificationCase.Status.APPROVED
            else {
                'hold_count': 0,
                'campaign_count': 0,
                'job_count': 0,
                'active_jobs_to_unhide': 0,
            }
        ),
        'rejection_impact': {
            'current_count': case.final_rejection_count,
            'next_count': (
                case.final_rejection_count + 1
                if decision == EmployerVerificationCase.Status.REJECTED
                else case.final_rejection_count
            ),
            'limit': MAX_FINAL_REJECTIONS,
            'will_lock_resubmission': bool(
                decision == EmployerVerificationCase.Status.REJECTED
                and case.final_rejection_count + 1 >= MAX_FINAL_REJECTIONS
            ),
        },
        'integrity_fingerprint': _integrity_fingerprint(case, scope=scope),
    }
    request_payload = {
        'decision': decision,
        'reason': reason,
        'tax_override': effective_override,
        'tax_override_reason': normalized_override_reason,
    }
    return request_payload, snapshot


def verification_decision_impact(
    case,
    *,
    actor,
    decision,
    reason,
    tax_override=False,
    tax_override_reason='',
):
    payload, snapshot = _prepare_final_decision(
        case,
        actor=actor,
        decision=decision,
        reason=reason,
        tax_override=tax_override,
        tax_override_reason=tax_override_reason,
    )
    return {
        **{key: value for key, value in snapshot.items() if key != 'integrity_fingerprint'},
        'unlocks_employer_capabilities': decision == EmployerVerificationCase.Status.APPROVED,
        'impact_token': create_impact_token(
            revision=case.lock_version,
            operation='employer_verification.decision',
            resource_key=case.public_id,
            normalized_payload={'request': payload, 'snapshot': snapshot},
        ),
    }


@transaction.atomic
def confirm_verification_decision(
    case,
    *,
    actor,
    decision,
    reason,
    impact_token,
    tax_override=False,
    tax_override_reason='',
):
    scope = lock_verification_identity(case, include_resources=True)
    case = scope.case
    try:
        payload, snapshot = _prepare_final_decision(
            case,
            actor=actor,
            decision=decision,
            reason=reason,
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
            scope=scope,
        )
    except ValidationError as current_state_error:
        payload, snapshot = _prepare_final_decision(
            case,
            actor=actor,
            decision=decision,
            reason=reason,
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
            scope=scope,
            enforce_current_state=False,
        )
        decode_impact_token(
            impact_token,
            operation='employer_verification.decision',
            resource_key=case.public_id,
            normalized_payload={'request': payload, 'snapshot': snapshot},
        )
        raise current_state_error
    claims = decode_impact_token(
        impact_token,
        operation='employer_verification.decision',
        resource_key=case.public_id,
        normalized_payload={'request': payload, 'snapshot': snapshot},
    )
    if claims['revision'] != case.lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi sau khi xem tác động.')

    released_holds = []
    if decision == EmployerVerificationCase.Status.APPROVED:
        released_holds = release_verification_holds(
            scope,
            actor=actor,
            reason='verification_reapproved',
        )
    case.status = decision
    case.reviewer = actor
    case.decided_at = timezone.now()
    case.decision_reason = payload['reason']
    case.decision_source = EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN
    case.decision_snapshot = snapshot
    case.tax_override_reason = payload['tax_override_reason']
    case.tax_override_by = actor if payload['tax_override'] else None
    if decision == EmployerVerificationCase.Status.REJECTED:
        case.final_rejection_count += 1
        if case.final_rejection_count >= MAX_FINAL_REJECTIONS:
            case.resubmission_locked_at = timezone.now()
    elif decision == EmployerVerificationCase.Status.APPROVED:
        case.resubmission_locked_at = None
    case.lock_version += 1
    case.save(
        update_fields=[
            'status',
            'reviewer',
            'decided_at',
            'decision_reason',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by',
            'final_rejection_count',
            'resubmission_locked_at',
            'lock_version',
            'updated_at',
        ]
    )
    event_type = {
        EmployerVerificationCase.Status.APPROVED: (
            EmployerVerificationEvent.EventType.REAPPROVED
            if released_holds
            else EmployerVerificationEvent.EventType.APPROVED
        ),
        EmployerVerificationCase.Status.CHANGES_REQUESTED: (
            EmployerVerificationEvent.EventType.CHANGES_REQUESTED
        ),
        EmployerVerificationCase.Status.REJECTED: EmployerVerificationEvent.EventType.REJECTED,
    }[decision]
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=event_type,
        payload={
            'reason': payload['reason'],
            'revision': case.revision,
            'decision_source': case.decision_source,
            'tax_advisory_status': snapshot['tax_advisory']['status'],
            'tax_override': payload['tax_override'],
            'tax_override_reason': payload['tax_override_reason'],
            'final_rejection_count': case.final_rejection_count,
            'resubmission_locked': case.resubmission_locked_at is not None,
        },
    )
    for hold in released_holds:
        EmployerVerificationEvent.objects.create(
            verification_case=case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.HOLD_RELEASED,
            payload={
                'hold_public_id': hold.public_id,
                'source': hold.source,
                'reason': hold.reason,
            },
        )
    record_admin_action(
        actor=actor,
        action='decide_employer_verification',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={
            'decision': decision,
            'user_public_id': scope.user.public_id,
            'tax_lookup_evidence_public_id': snapshot['tax_advisory']['evidence_public_id'],
            'tax_override': payload['tax_override'],
            'tax_override_reason': payload['tax_override_reason'],
            'released_verification_hold_count': len(released_holds),
        },
    )
    _queue_verification_notification(
        case,
        event_type=decision,
        reason=reason,
    )
    return case


@transaction.atomic
def unlock_verification_resubmission(case, *, actor, reason, lock_version):
    require_admin_permission(actor, VERIFICATION_RESUBMISSION_UNLOCK_PERMISSION)
    case = lock_verification_identity(case).case
    reason = reason.strip()
    if not reason:
        _workflow_error(
            'VERIFICATION_REASON_REQUIRED',
            'Cần nhập lý do mở khóa nộp lại.',
        )
    if case.lock_version != lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi. Vui lòng tải lại.')
    if (
        case.status != EmployerVerificationCase.Status.REJECTED
        or case.resubmission_locked_at is None
    ):
        _workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Chỉ hồ sơ bị từ chối và đang khóa nộp lại mới có thể được mở khóa.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.REJECTED],
        )
    case.resubmission_locked_at = None
    case.lock_version += 1
    case.save(update_fields=['resubmission_locked_at', 'lock_version', 'updated_at'])
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=EmployerVerificationEvent.EventType.RESUBMISSION_UNLOCKED,
        payload={
            'reason': reason,
            'final_rejection_count': case.final_rejection_count,
        },
    )
    record_admin_action(
        actor=actor,
        action='unlock_employer_verification_resubmission',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={
            'reason': reason,
            'final_rejection_count': case.final_rejection_count,
        },
    )
    return case


def _prepare_lifecycle_action(case, *, actor, action, reason, scope=None):
    require_admin_permission(actor, VERIFICATION_REVOKE_PERMISSION)
    scope = scope or _verification_snapshot_scope(case)
    if action not in LIFECYCLE_ACTIONS:
        _workflow_error(
            'VERIFICATION_LIFECYCLE_ACTION_INVALID',
            'Thao tác vòng đời xác thực không hợp lệ.',
        )
    if case.status != EmployerVerificationCase.Status.APPROVED:
        _workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Chỉ hồ sơ đã duyệt mới có thể bị thu hồi hoặc hết hiệu lực.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.APPROVED],
        )
    reason = reason.strip()
    if not reason:
        _workflow_error(
            'VERIFICATION_REASON_REQUIRED',
            'Cần nhập lý do cho thay đổi hiệu lực xác thực.',
        )
    _, jobs, campaigns, _ = _resource_rows(case, scope=scope)
    campaign_count = len(campaigns)
    job_count = len(jobs)
    active_job_count = len(_public_job_ids(case, scope=scope))
    snapshot = {
        'case_public_id': case.public_id,
        'case_revision': case.revision,
        'lock_version': case.lock_version,
        'action': action,
        'reason': reason,
        'capability_impact': {
            'candidate_data_access': 'blocked',
            'job_approval': 'blocked',
            'job_workspace': 'unchanged',
            'job_create_edit_submit': 'unchanged',
        },
        'resources': {
            'campaign_count': campaign_count,
            'job_count': job_count,
            'active_jobs_hidden_from_public': active_job_count,
        },
        'integrity_fingerprint': _integrity_fingerprint(case, scope=scope),
    }
    return {'action': action, 'reason': reason}, snapshot


def verification_lifecycle_impact(case, *, actor, action, reason):
    payload, snapshot = _prepare_lifecycle_action(
        case,
        actor=actor,
        action=action,
        reason=reason,
    )
    return {
        **{key: value for key, value in snapshot.items() if key != 'integrity_fingerprint'},
        'impact_token': create_impact_token(
            revision=case.lock_version,
            operation='employer_verification.lifecycle',
            resource_key=case.public_id,
            normalized_payload={'request': payload, 'snapshot': snapshot},
        ),
    }


@transaction.atomic
def confirm_verification_lifecycle_action(
    case,
    *,
    actor,
    action,
    reason,
    impact_token,
):
    scope = lock_verification_identity(case, include_resources=True)
    case = scope.case
    payload, snapshot = _prepare_lifecycle_action(
        case,
        actor=actor,
        action=action,
        reason=reason,
        scope=scope,
    )
    claims = decode_impact_token(
        impact_token,
        operation='employer_verification.lifecycle',
        resource_key=case.public_id,
        normalized_payload={'request': payload, 'snapshot': snapshot},
    )
    if claims['revision'] != case.lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi sau khi xem tác động.')

    hold_reason = {
        EmployerVerificationCase.Status.REVOKED: (
            EmployerComplianceHold.Reason.VERIFICATION_REVOKED
        ),
        EmployerVerificationCase.Status.EXPIRED: (
            EmployerComplianceHold.Reason.VERIFICATION_EXPIRED
        ),
    }[action]
    case.status = action
    case.reviewer = actor
    case.decided_at = timezone.now()
    case.decision_reason = payload['reason']
    case.decision_source = EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN
    case.decision_snapshot = snapshot
    case.tax_override_reason = ''
    case.tax_override_by = None
    case.lock_version += 1
    case.save(
        update_fields=[
            'status',
            'reviewer',
            'decided_at',
            'decision_reason',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by',
            'lock_version',
            'updated_at',
        ]
    )
    hold, created = apply_verification_hold(scope, reason=hold_reason, actor=actor)
    event_type = {
        EmployerVerificationCase.Status.REVOKED: EmployerVerificationEvent.EventType.REVOKED,
        EmployerVerificationCase.Status.EXPIRED: EmployerVerificationEvent.EventType.EXPIRED,
    }[action]
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=event_type,
        payload={
            'reason': payload['reason'],
            'revision': case.revision,
        },
    )
    if created:
        EmployerVerificationEvent.objects.create(
            verification_case=case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.HOLD_APPLIED,
            payload={
                'hold_public_id': hold.public_id,
                'source': hold.source,
                'reason': hold.reason,
                'campaign_count': len(scope.campaigns),
                'job_count': len(scope.jobs),
            },
        )
    record_admin_action(
        actor=actor,
        action=f'{action}_employer_verification',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={
            'reason': payload['reason'],
            'hold_public_id': hold.public_id,
        },
    )
    _queue_verification_notification(case, event_type=action, reason=reason)
    return case


__all__ = [
    'InvalidImpactToken',
    'StaleImpactToken',
    'confirm_verification_decision',
    'confirm_verification_lifecycle_action',
    'get_or_create_verification_case',
    'reconcile_completed_verification_cases',
    'reconcile_recruiter_verification',
    'reconcile_verification_case',
    'record_verification_upload',
    'recruiter_is_approved',
    'recruiter_requires_approved_verification',
    'required_document_types',
    'review_verification_document',
    'start_verification_review',
    'verification_checks',
    'verification_decision_impact',
    'verification_lifecycle_impact',
]
