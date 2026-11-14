"""Read model of the employer's company page workspace."""

from dataclasses import asdict

from django.db.models import Prefetch
from django.db.models.functions import Coalesce

from apps.jobs.models import Job
from common.db.search import search_q

from ..models import CompanyPageEditorGrant
from ..models.page_access import is_company_owner, is_page_eligible, page_access_recruiters
from ..page_registry import company_page_registry
from .company_page import (
    build_public_company_profile,
    company_page_layout,
    company_page_queryset,
    pinned_public_jobs,
)
from .company_page_content_form import company_page_content_form

PINNABLE_JOB_LIMIT = 20


def _job_reference(job):
    """Public metadata only: nothing here comes from the recruiter workspace."""
    return {
        'public_id': job.public_id,
        'title': job.title,
        'slug': job.slug,
        'published_at': job.published_at,
    }


def _workspace_layout(company, pinned_jobs):
    layout = company_page_layout(company)
    return {
        'section_order': layout['section_order'],
        'hidden_sections': layout['hidden_sections'],
        'accent': layout['accent'],
        'pinned_job_public_ids': [job.public_id for job in pinned_jobs],
        'lock_version': layout['lock_version'],
    }


def current_company_page_layout(company_id):
    company = company_page_queryset().get(pk=company_id)
    return _workspace_layout(company, pinned_public_jobs(company))


def company_page_workspace(recruiter, access, *, request=None):
    """Everything the workspace renders, with permissions decided by the server."""
    company = company_page_queryset().get(pk=recruiter.company_id)
    pinned_jobs = list(pinned_public_jobs(company))
    content = build_public_company_profile(
        company,
        request=request,
        apply_layout=False,
        pinned_jobs=pinned_jobs,
    )
    content_form, completeness = company_page_content_form(
        company,
        recruiter=recruiter,
        request=request,
    )
    return {
        'company': {
            'public_id': company.public_id,
            'slug': company.slug,
            'display_name': company.display_name,
            'public_path': company.public_page_path,
            'is_public': not company.content_policy_hold,
            'is_indexable': company.is_indexable,
        },
        'permissions': {**asdict(access), 'blockers': list(access.blockers)},
        'registry': company_page_registry(),
        'layout': _workspace_layout(company, pinned_jobs),
        'pinned_jobs': [_job_reference(job) for job in pinned_jobs],
        'content': content,
        'content_form': content_form,
        'completeness': completeness,
        'stats': {
            'follower_count': company.follower_count,
            'active_public_job_count': content['stats']['active_public_job_count'],
        },
    }


def pinnable_company_jobs(company_id, *, query=''):
    """Jobs an editor may pin: the company's publicly available ones, newest first."""
    jobs = Job.publicly_available_queryset().filter(company_id=company_id)
    if query:
        jobs = jobs.filter(search_q('title', query))
    jobs = jobs.order_by(Coalesce('published_at', 'created_at').desc(), '-id')
    return [
        _job_reference(job)
        for job in jobs.only('public_id', 'title', 'slug', 'published_at')[:PINNABLE_JOB_LIMIT]
    ]


def _masked_email(email):
    local, _, domain = email.partition('@')
    return f'{local[:1]}***@{domain}'


def _editor_row(recruiter, *, owner_eligible):
    eligible = is_page_eligible(recruiter)
    grant = next(iter(recruiter.active_page_grants), None)
    return {
        'member_id': recruiter.public_id,
        'display_name': recruiter.user.full_name,
        'position_title': recruiter.position_title,
        'email_masked': _masked_email(recruiter.user.email),
        'company_role': 'owner' if is_company_owner(recruiter) else 'member',
        'eligible': eligible,
        'grant': grant
        and {
            'public_id': grant.public_id,
            'granted_at': grant.granted_at,
            'granted_by_name': grant.granted_by.full_name if grant.granted_by else '',
            # A grant only works while both sides remain eligible representatives.
            'effective': eligible and owner_eligible,
        },
    }


def company_page_editor_rows(company_id):
    """Every recruiter of the company with their delegation state, owner first."""
    active_grants = CompanyPageEditorGrant.objects.filter(revoked_at__isnull=True).select_related(
        'granted_by'
    )
    recruiters = list(
        page_access_recruiters(company_id)
        .select_related('user')
        .prefetch_related(
            Prefetch('page_editor_grants', queryset=active_grants, to_attr='active_page_grants')
        )
    )
    owner_eligible = any(is_page_eligible(row) for row in recruiters if is_company_owner(row))
    recruiters.sort(key=lambda row: (not is_company_owner(row), row.user.full_name.lower(), row.pk))
    return [_editor_row(row, owner_eligible=owner_eligible) for row in recruiters]
