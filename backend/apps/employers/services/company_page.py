"""Write-side commands for the public company page."""

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action
from apps.jobs.models import Job

from ..models import Company, CompanyPageEvent, CompanyPageSettings, CompanyPinnedJob
from ..page_registry import PINNED_JOB_LIMIT, resolve_section_order

LAYOUT_FIELDS = ('section_order', 'hidden_sections', 'accent')


class CompanyPageLayoutStale(Exception):
    """The caller's ``lock_version`` is behind the saved layout."""


@transaction.atomic
def set_company_page_policy_hold(company, *, actor, hold, reason):
    """Hide or restore a public company page and leave both audit trails."""
    # QuerySet.update() on purpose: Company.save() would move updated_at, the
    # optimistic-lock base of open company update requests. The state filter
    # lets only one of two concurrent identical decisions write audit rows.
    changed = Company.objects.filter(pk=company.pk, content_policy_hold=not hold).update(
        content_policy_hold=hold
    )
    if not changed:
        raise ValidationError(
            {
                'detail': (
                    'Trang công ty đang bị tạm ẩn.'
                    if hold
                    else 'Trang công ty hiện không bị tạm ẩn.'
                )
            }
        )
    CompanyPageEvent.objects.create(
        company=company,
        actor=actor,
        event_type=(
            CompanyPageEvent.EventType.POLICY_HOLD_APPLIED
            if hold
            else CompanyPageEvent.EventType.POLICY_HOLD_RELEASED
        ),
        payload={'reason': reason},
    )
    record_admin_action(
        actor=actor,
        action='apply_company_page_hold' if hold else 'release_company_page_hold',
        target_type='company',
        target_public_id=company.public_id,
        payload={'reason': reason},
    )


def _replace_pinned_jobs(company, *, actor, public_ids):
    """Pin exactly ``public_ids`` in that order; False when nothing changes."""
    before = list(
        CompanyPinnedJob.objects.filter(company=company).values_list('job__public_id', flat=True)
    )
    if public_ids == before:
        return False
    if len(public_ids) > PINNED_JOB_LIMIT or len(set(public_ids)) != len(public_ids):
        raise ValidationError(
            {'pinned_job_public_ids': [f'Ghim tối đa {PINNED_JOB_LIMIT} tin, mỗi tin một lần.']}
        )
    # The canonical public predicate, never the recruiter's own tenant scope:
    # a pin may only point at a job any visitor of the page can open.
    jobs = {
        job.public_id: job
        for job in Job.publicly_available_queryset()
        .filter(company_id=company.pk, public_id__in=public_ids)
        .only('id', 'public_id')
    }
    if len(jobs) != len(public_ids):
        raise ValidationError(
            {'pinned_job_public_ids': ['Chỉ ghim được tin đang hiển thị công khai của công ty.']}
        )
    CompanyPinnedJob.objects.filter(company=company).delete()
    CompanyPinnedJob.objects.bulk_create(
        CompanyPinnedJob(
            company=company,
            job=jobs[public_id],
            sort_order=position,
            pinned_by=actor,
        )
        for position, public_id in enumerate(public_ids)
    )
    CompanyPageEvent.objects.create(
        company=company,
        actor=actor,
        event_type=CompanyPageEvent.EventType.PINNED_JOBS_UPDATED,
        payload={'before': before, 'after': public_ids},
    )
    return True


@transaction.atomic
def update_company_page_layout(company, *, actor, lock_version, changes):
    """Apply an editor's layout change; it reaches the public page at once.

    ``changes`` holds any of ``LAYOUT_FIELDS`` and ``pinned_job_public_ids``,
    already validated against the registry. Everything lives in the settings
    and pin tables, so ``Company.updated_at`` never moves.
    """
    # No row yet means registry defaults at version 0; it is created only by
    # the first real change.
    page_settings = CompanyPageSettings.objects.select_for_update().filter(
        company=company
    ).first() or CompanyPageSettings(company=company)
    if page_settings.lock_version != lock_version:
        raise CompanyPageLayoutStale

    before = {
        'section_order': resolve_section_order(page_settings.section_order),
        'hidden_sections': page_settings.hidden_sections,
        'accent': page_settings.accent,
    }
    after = {**before, **{field: changes[field] for field in LAYOUT_FIELDS if field in changes}}
    layout_changed = after != before
    pins_changed = 'pinned_job_public_ids' in changes and _replace_pinned_jobs(
        company, actor=actor, public_ids=changes['pinned_job_public_ids']
    )
    if not (layout_changed or pins_changed):
        return

    if layout_changed:
        for field, value in after.items():
            setattr(page_settings, field, value)
        CompanyPageEvent.objects.create(
            company=company,
            actor=actor,
            event_type=CompanyPageEvent.EventType.LAYOUT_UPDATED,
            payload={'before': before, 'after': after},
        )
    page_settings.lock_version += 1
    page_settings.updated_by = actor
    try:
        with transaction.atomic():
            page_settings.save()
    except IntegrityError as error:
        # Two first saves raced; the other one created the row.
        raise CompanyPageLayoutStale from error
