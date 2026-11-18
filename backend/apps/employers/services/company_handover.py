"""Handing one recruiter's jobs and campaigns at a company to another member.

Resources belong to the recruiter who posted them, so when someone leaves (or
is about to) nobody else can see or answer their applications. The company
manager hands them to a verified member: jobs keep their applications and
history, campaigns keep their jobs, only the responsible recruiter changes.
"""

from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.campaigns.models import RecruitmentCampaign
from apps.jobs.models import Job

from ..models import (
    EmployerCompanyLinkEvent,
    EmployerComplianceHold,
    EmployerNotification,
    RecruiterProfile,
)
from ..models.representation import eligible_representatives_queryset
from .company_membership import company_owners
from .notifications import emit_employer_event


def _manager_company(user):
    manager = RecruiterProfile.objects.select_related('company').filter(user=user).first()
    if (
        manager is None
        or manager.company_id is None
        or not company_owners(manager.company).filter(pk=manager.pk).exists()
    ):
        raise PermissionDenied('Chỉ quản lý công ty đã xác thực mới giao lại được tin tuyển dụng.')
    return manager.company


def handover_resources(company, source):
    """The jobs and campaigns ``source`` (a RecruiterProfile) is responsible for at ``company``."""
    jobs = Job.objects.filter(company=company, posted_by_id=source.user_id)
    campaigns = RecruitmentCampaign.objects.filter(owner=source).filter(
        Q(company=company) | Q(jobs__company=company)
    )
    return jobs, campaigns.distinct()


@transaction.atomic
def hand_over_recruiter_resources(manager_user, *, source_id, target_id):
    """Give every job and campaign ``source_id`` holds at the company to ``target_id``."""
    company = _manager_company(manager_user)
    source = (
        RecruiterProfile.objects.select_for_update(of=('self',))
        .select_related('user')
        .filter(public_id=source_id)
        .first()
    )
    if source is None:
        raise NotFound('Không tìm thấy người đang giữ tin tuyển dụng.')
    target = (
        eligible_representatives_queryset()
        .select_for_update(of=('self',))
        .select_related('user')
        .filter(company=company, public_id=target_id)
        .exclude(
            pk__in=EmployerComplianceHold.objects.filter(
                status=EmployerComplianceHold.Status.ACTIVE
            ).values('recruiter_id')
        )
        .first()
    )
    if target is None:
        raise ValidationError(
            {'target': 'Chỉ giao được cho thành viên của công ty đã xác thực tài khoản.'}
        )
    if target.pk == source.pk:
        raise ValidationError({'target': 'Hãy chọn một thành viên khác.'})

    jobs, campaigns = handover_resources(company, source)
    job_ids = list(jobs.select_for_update(of=('self',)).values_list('pk', flat=True))
    campaign_ids = list(campaigns.values_list('pk', flat=True))
    if not job_ids and not campaign_ids:
        raise ValidationError({'detail': 'Người này không còn tin tuyển dụng nào tại công ty.'})
    # Campaign first: a job may only sit in a campaign its poster owns.
    RecruitmentCampaign.objects.filter(pk__in=campaign_ids).update(owner=target)
    Job.objects.filter(pk__in=job_ids).update(posted_by=target.user)

    EmployerCompanyLinkEvent.objects.create(
        recruiter=source,
        company=company,
        actor=manager_user,
        event_type=EmployerCompanyLinkEvent.EventType.RESOURCES_HANDED_OVER,
        reason=f'Giao cho {target.user.full_name or target.user.email}',
        impact_snapshot={
            'target_recruiter_public_id': target.public_id,
            'job_ids': job_ids,
            'campaign_ids': campaign_ids,
        },
    )
    giver = source.user.full_name or source.user.email
    emit_employer_event(
        recipient=target.user,
        actor=manager_user,
        event_type=EmployerNotification.EventType.JOBS_HANDED_OVER,
        dedupe_key=f'jobs-handed-over:{source.public_id}:{target.public_id}:{min(job_ids or [0])}',
        message=(
            f'Bạn được giao {len(job_ids)} tin tuyển dụng và {len(campaign_ids)} chiến dịch '
            f'của {giver}, kèm toàn bộ hồ sơ ứng tuyển.'
        ),
        subject_public_id=company.public_id,
    )
    if source.company_id == company.pk:
        emit_employer_event(
            recipient=source.user,
            actor=manager_user,
            event_type=EmployerNotification.EventType.JOBS_HANDED_OVER,
            dedupe_key=f'jobs-handed-away:{source.public_id}:{target.public_id}:{min(job_ids or [0])}',
            message=(
                f'Quản lý công ty đã giao tin tuyển dụng của bạn cho '
                f'{target.user.full_name or target.user.email}.'
            ),
            subject_public_id=company.public_id,
        )
    return {'job_count': len(job_ids), 'campaign_count': len(campaign_ids)}
