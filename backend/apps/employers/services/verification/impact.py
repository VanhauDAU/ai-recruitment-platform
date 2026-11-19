"""Integrity fingerprint and resource impact of a verification case.

Decision and lifecycle previews hash this snapshot into the impact token, so a
confirmation is refused when the case, its proof or its jobs changed meanwhile.
"""

import hashlib
import json
import re
import unicodedata

from common.vietnam_time import vietnam_today

from ...models import (
    Company,
    EmployerComplianceHold,
    EmployerComplianceHoldCampaign,
    EmployerComplianceHoldJob,
)
from ..compliance import LockedVerificationScope


def normalized_legal_text(value):
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


def verification_snapshot_scope(case):
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


def integrity_fingerprint(case, *, scope=None):
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


def resource_rows(case, *, scope=None):
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


def public_job_ids(case, *, scope=None, ignored_hold_ids=()):
    """Mirror the canonical public predicate for a bounded recruiter resource set."""

    recruiter, jobs, campaigns, _ = resource_rows(case, scope=scope)
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
    today = vietnam_today()
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


def verification_hold_impact(case, *, scope=None):
    _, jobs, campaigns, holds = resource_rows(case, scope=scope)
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
        affected_job_ids & public_job_ids(case, scope=scope, ignored_hold_ids=hold_ids)
    )
    return {
        'hold_count': len(hold_ids),
        'campaign_count': len(campaign_ids),
        'job_count': len(job_ids),
        'active_jobs_to_unhide': active_job_count,
    }
