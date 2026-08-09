"""Job-posting mutation workflows owned by the recruiter who created the job."""

from copy import copy
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.employers.models import CampaignActivity, RecruitmentCampaign
from apps.employers.services import (
    ensure_recruiter_job_workspace,
    record_campaign_activity,
    recruiter_job_posting_entitlement,
    recruiter_readiness_state,
)
from apps.sitecontent.selectors.settings import get_int_setting

from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobBenefit,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    JobStatusHistory,
    JobWorkSchedule,
)

FREE_JOB_QUOTA = 3
VERIFIED_LEVEL_THREE_JOB_QUOTA = 100
MAX_DEADLINE_DAYS = 30
MAX_PUBLIC_LIFETIME_DAYS = 90
EXPIRED_JOB_RENEWAL_GRACE_DAYS = 30


def _locked_recruiter(user):
    recruiter, _ = ensure_recruiter_job_workspace(user, lock=True)
    if recruiter is None or recruiter.company_id is None:
        raise ValidationError('Cập nhật thông tin công ty trước khi đăng tin.')
    return recruiter


def _lock_campaigns(*campaign_ids):
    ids = sorted({campaign_id for campaign_id in campaign_ids if campaign_id is not None})
    return {
        campaign.pk: campaign
        for campaign in RecruitmentCampaign.objects.select_for_update(of=('self',))
        .filter(pk__in=ids)
        .order_by('pk')
    }


def _locked_job(job, *, extra_campaign_ids=()):
    current_campaign_id = Job.objects.filter(pk=job.pk).values_list('campaign_id', flat=True).get()
    locked_campaigns = _lock_campaigns(current_campaign_id, *extra_campaign_ids)
    locked_job = (
        Job.objects.select_for_update(of=('self',)).select_related('campaign').get(pk=job.pk)
    )
    if locked_job.campaign_id != current_campaign_id:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_RESOURCE_CHANGED',
                'detail': 'Chiến dịch của tin vừa thay đổi. Vui lòng tải lại.',
            }
        )
    return locked_job, locked_campaigns


def _locked_requested_campaign(requested_campaign, locked_campaigns):
    if requested_campaign is None:
        return None
    locked_campaign = locked_campaigns.get(requested_campaign.pk)
    if locked_campaign is None:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_RESOURCE_CHANGED',
                'detail': 'Chiến dịch vừa thay đổi. Vui lòng tải lại.',
            }
        )
    return locked_campaign


def _validate_campaign_for_write(campaign, *, recruiter):
    if campaign is None:
        return
    if campaign.owner_id != recruiter.pk:
        raise ValidationError({'campaign': 'Bạn không có quyền dùng chiến dịch này.'})
    if campaign.policy_hold:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': 'Chiến dịch đang bị policy hold.',
            }
        )
    if campaign.status in {
        RecruitmentCampaign.Status.COMPLETED,
        RecruitmentCampaign.Status.CANCELLED,
    }:
        raise ValidationError({'campaign': 'Chiến dịch này không còn nhận tin tuyển dụng.'})


def _validate_job_for_write(job):
    if job.policy_hold or job.moderation_hold:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': 'Tin tuyển dụng đang bị hold.',
            }
        )


def _free_job_quota():
    return max(get_int_setting('employer_free_job_quota', FREE_JOB_QUOTA), 0)


def _verified_level_three_job_quota():
    return max(
        get_int_setting(
            'employer_verified_level_three_job_quota',
            VERIFIED_LEVEL_THREE_JOB_QUOTA,
        ),
        0,
    )


def _posting_quota(user):
    recruiter, entitlement = recruiter_job_posting_entitlement(user)
    is_verified_level_three = entitlement['verified_job_quota_eligible']
    return (
        recruiter,
        entitlement,
        (_verified_level_three_job_quota() if is_verified_level_three else _free_job_quota()),
    )


def _quota_exhausted_message(*, verified_level_three, limit):
    if verified_level_three:
        return f'Bạn đã dùng hết {limit} lượt đăng tin của tài khoản Cấp 3.'
    return (
        f'Bạn đã dùng hết {limit} lượt đăng tin miễn phí. '
        'Hoàn tất xác thực hồ sơ và đạt Cấp 3 để có quota 100 tin.'
    )


def _record_status(
    job,
    *,
    from_status,
    to_status,
    user,
    note='',
    actor_role=JobStatusHistory.ActorRole.EMPLOYER,
):
    JobStatusHistory.objects.create(
        job=job,
        from_status=from_status,
        to_status=to_status,
        changed_by=user,
        actor_role=actor_role,
        note=note,
    )
    if job.campaign_id:
        record_campaign_activity(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_STATUS_CHANGED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={
                'title': job.title,
                'from_status': from_status,
                'to_status': to_status,
            },
        )


def _record_job_assignment(job, *, previous_campaign, user):
    if previous_campaign and previous_campaign.pk != job.campaign_id:
        record_campaign_activity(
            campaign=previous_campaign,
            event_type=CampaignActivity.EventType.JOB_REMOVED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title},
        )
    if job.campaign_id and (previous_campaign is None or previous_campaign.pk != job.campaign_id):
        record_campaign_activity(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_ADDED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title},
        )
    elif job.campaign_id:
        record_campaign_activity(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_UPDATED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title},
        )


def _move_public_revision_to_review(job, *, user, note='', update_fields=()):
    """Hide a changed public revision until an admin approves it again."""
    previous_status = job.status
    now = timezone.now()
    job.status = Job.Status.PENDING
    job.submitted_at = job.submitted_at or now
    job.published_at = None
    job.approved_at = None
    job.closed_at = None
    job.rejected_reason = ''
    job.slug = f'{slugify(job.title)}-{job.public_id}'
    job.save(
        update_fields=[
            *update_fields,
            'status',
            'submitted_at',
            'published_at',
            'approved_at',
            'closed_at',
            'rejected_reason',
            'slug',
            'updated_at',
        ]
    )
    _record_status(
        job,
        from_status=previous_status,
        to_status=Job.Status.PENDING,
        user=user,
        note=note,
    )
    return job


def _validate_publishable(job):
    errors = {}
    today = timezone.localdate()
    if not job.title.strip():
        errors['title'] = 'Nhập tiêu đề tin tuyển dụng.'
    if not job.description.strip():
        errors['description'] = 'Nhập mô tả công việc.'
    if not job.requirements.strip():
        errors['requirements'] = 'Nhập yêu cầu ứng viên.'
    if not job.benefits.strip():
        errors['benefits'] = 'Nhập quyền lợi ứng viên.'
    if not job.position_level:
        errors['position_level'] = 'Chọn cấp bậc.'
    if not job.employment_type:
        errors['employment_type'] = 'Chọn loại công việc.'
    if not (job.work_types or job.work_type):
        errors['work_types'] = 'Chọn ít nhất một hình thức làm việc.'
    if not job.education_level:
        errors['education_level'] = 'Chọn yêu cầu học vấn.'
    if not job.experience_years:
        errors['experience_years'] = 'Chọn yêu cầu kinh nghiệm.'
    if job.salary_type is None:
        errors['salary_type'] = 'Chọn loại lương và nhập đầy đủ mức lương.'
    elif job.salary_type == Job.SalaryType.RANGE:
        if job.salary_min is None and job.salary_max is None:
            errors['salary_type'] = 'Nhập ít nhất một mức lương.'
        elif (
            job.salary_min is not None
            and job.salary_max is not None
            and job.salary_max < job.salary_min
        ):
            errors['salary_max'] = 'Mức lương tối đa không được nhỏ hơn mức tối thiểu.'
    elif job.salary_type in (Job.SalaryType.FIXED, Job.SalaryType.FROM):
        if job.salary_min is None:
            errors['salary_min'] = 'Loại lương này cần mức lương tối thiểu.'
    elif job.salary_type == Job.SalaryType.UP_TO and job.salary_max is None:
        errors['salary_max'] = 'Loại lương này cần mức lương tối đa.'
    if not job.number_of_vacancies or job.number_of_vacancies < 1:
        errors['number_of_vacancies'] = 'Số lượng tuyển phải từ 1 trở lên.'
    if not job.job_locations.exists():
        errors['job_locations'] = 'Thêm ít nhất một địa điểm làm việc.'
    if not job.category_assignments.filter(
        role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
    ).exists():
        errors['category_assignments'] = 'Chọn một vị trí chuyên môn chính.'
    if job.deadline is None or job.deadline < today:
        errors['deadline'] = 'Hạn nộp phải từ hôm nay trở đi.'
    elif job.deadline > today + timedelta(days=MAX_DEADLINE_DAYS):
        errors['deadline'] = f'Hạn nộp không được quá {MAX_DEADLINE_DAYS} ngày kể từ hôm nay.'
    contact = getattr(job, 'application_contact', None)
    if contact is None:
        errors['application_contact'] = 'Nhập thông tin người nhận hồ sơ.'
    else:
        contact_errors = {}
        if not contact.recipient_name.strip():
            contact_errors['recipient_name'] = 'Nhập họ tên người nhận hồ sơ.'
        if not contact.phone.strip():
            contact_errors['phone'] = 'Nhập số điện thoại người nhận hồ sơ.'
        if not contact.emails.exists():
            contact_errors['emails'] = 'Nhập ít nhất một email nhận hồ sơ.'
        if contact_errors:
            errors['application_contact'] = contact_errors
    if errors:
        raise ValidationError(errors)


def employer_job_posting_context(user):
    recruiter, entitlement, limit = _posting_quota(user)
    _, readiness = recruiter_readiness_state(user)
    count = Job.objects.filter(posted_by=user, submitted_at__isnull=False).count()
    reason = ''
    has_company = recruiter is not None and recruiter.company_id is not None
    if not readiness['job_workspace_ready']:
        workspace_blocker = next(
            (
                blocker
                for blocker in readiness['blockers']
                if 'job_workspace' in blocker['capabilities']
            ),
            None,
        )
        reason = workspace_blocker['message'] if workspace_blocker else 'Workspace chưa sẵn sàng.'
    elif not has_company:
        reason = 'Cập nhật thông tin công ty trước khi đăng tin.'
    elif count >= limit:
        reason = _quota_exhausted_message(
            verified_level_three=entitlement['verified_job_quota_eligible'],
            limit=limit,
        )
    return {
        'verification_completed': entitlement['verification_completed'],
        'admin_approved': entitlement['admin_approved'],
        'account_level': entitlement['account_level'],
        'verified_job_quota_eligible': entitlement['verified_job_quota_eligible'],
        'job_workspace_ready': readiness['job_workspace_ready'],
        'candidate_data_access': readiness['candidate_data_access'],
        'dpa_status': readiness['dpa_status'],
        'blockers': readiness['blockers'],
        'published_jobs_count': count,
        'publish_limit': limit,
        'publish_remain': max(limit - count, 0),
        # Compatibility for clients deployed before the quota contract rename.
        'free_publish_limit': limit,
        'free_publish_remain': max(limit - count, 0),
        'job_postable': readiness['job_workspace_ready'] and has_company and count < limit,
        'approval_required': True,
        'block_reason': reason,
    }


@transaction.atomic
def save_job_draft(serializer, user):
    """Persist a partial job form; drafts never consume a publication credit."""
    recruiter = _locked_recruiter(user)
    if serializer.instance is None:
        requested_campaign = serializer.validated_data.get('campaign')
        locked_campaigns = _lock_campaigns(
            requested_campaign.pk if requested_campaign is not None else None
        )
        locked_campaign = _locked_requested_campaign(requested_campaign, locked_campaigns)
        _validate_campaign_for_write(locked_campaign, recruiter=recruiter)
        if requested_campaign is not None:
            serializer.validated_data['campaign'] = locked_campaign
        job = serializer.save(posted_by=user, company=recruiter.company, status=Job.Status.DRAFT)
        _record_job_assignment(job, previous_campaign=None, user=user)
        _record_status(job, from_status='', to_status=Job.Status.DRAFT, user=user)
        return job
    requested_campaign = serializer.validated_data.get('campaign', serializer.instance.campaign)
    job, locked_campaigns = _locked_job(
        serializer.instance,
        extra_campaign_ids=(requested_campaign.pk if requested_campaign is not None else None,),
    )
    serializer.instance = job
    if job.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền lưu nháp tin này.')
    _validate_job_for_write(job)
    previous_campaign = locked_campaigns.get(job.campaign_id)
    locked_requested_campaign = _locked_requested_campaign(requested_campaign, locked_campaigns)
    _validate_campaign_for_write(locked_requested_campaign, recruiter=recruiter)
    if 'campaign' in serializer.validated_data:
        serializer.validated_data['campaign'] = locked_requested_campaign
    job = serializer.save()
    _record_job_assignment(job, previous_campaign=previous_campaign, user=user)
    return job


@transaction.atomic
def publish_job(job, user):
    """Submit a recruiter-owned job to the mandatory admin review queue."""
    recruiter = _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền gửi duyệt tin này.')
    _validate_job_for_write(job)
    _validate_campaign_for_write(job.campaign, recruiter=recruiter)
    if job.status == Job.Status.CLOSED:
        raise ValidationError('Mở lại tin trước khi gửi duyệt lại.')
    _validate_publishable(job)
    if job.submitted_at is None:
        _, entitlement, limit = _posting_quota(user)
        used = Job.objects.filter(posted_by=user, submitted_at__isnull=False).count()
        if used >= limit:
            raise ValidationError(
                {
                    'detail': _quota_exhausted_message(
                        verified_level_three=entitlement['verified_job_quota_eligible'],
                        limit=limit,
                    ),
                }
            )
    # A pending post was already charged and remains in the same review queue
    # after an owner updates its content. An active post becomes pending again
    # so every public revision is reviewed before it is shown to candidates.
    if job.status == Job.Status.PENDING:
        return job
    previous = job.status
    now = timezone.now()
    job.status = Job.Status.PENDING
    job.submitted_at = job.submitted_at or now
    job.published_at = None
    job.approved_at = None
    job.closed_at = None
    job.rejected_reason = ''
    job.slug = f'{slugify(job.title)}-{job.public_id}'
    job.save(
        update_fields=[
            'status',
            'submitted_at',
            'published_at',
            'approved_at',
            'closed_at',
            'rejected_reason',
            'slug',
            'updated_at',
        ]
    )
    _record_status(job, from_status=previous, to_status=Job.Status.PENDING, user=user)
    return job


@transaction.atomic
def create_pending_job(serializer, user):
    """Compatibility adapter: a complete create enters the review queue."""
    return publish_job(save_job_draft(serializer, user), user)


@transaction.atomic
def update_employer_job(serializer, user):
    """Persist an employer's existing job through the domain mutation boundary."""
    recruiter = _locked_recruiter(user)
    requested_campaign = serializer.validated_data.get('campaign', serializer.instance.campaign)
    serializer.instance, locked_campaigns = _locked_job(
        serializer.instance,
        extra_campaign_ids=(requested_campaign.pk if requested_campaign is not None else None,),
    )
    if serializer.instance.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền chỉnh sửa tin này.')
    _validate_job_for_write(serializer.instance)
    previous_status = serializer.instance.status
    previous_campaign = locked_campaigns.get(serializer.instance.campaign_id)
    locked_requested_campaign = _locked_requested_campaign(requested_campaign, locked_campaigns)
    _validate_campaign_for_write(locked_requested_campaign, recruiter=recruiter)
    if 'campaign' in serializer.validated_data:
        serializer.validated_data['campaign'] = locked_requested_campaign
    job = serializer.save()
    _record_job_assignment(job, previous_campaign=previous_campaign, user=user)
    if previous_status == Job.Status.ACTIVE:
        return _move_public_revision_to_review(
            job,
            user=user,
            note='Cập nhật nội dung tin đang tuyển',
        )
    return job


@transaction.atomic
def close_job(job, user):
    _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.ACTIVE:
        raise ValidationError('Chỉ có thể đóng tin đang tuyển của bạn.')
    job.status = Job.Status.CLOSED
    job.closed_at = timezone.now()
    job.save(update_fields=['status', 'closed_at', 'updated_at'])
    _record_status(job, from_status=Job.Status.ACTIVE, to_status=Job.Status.CLOSED, user=user)
    return job


@transaction.atomic
def reopen_job(job, user, deadline):
    recruiter = _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.CLOSED:
        raise ValidationError('Chỉ có thể mở lại tin đã đóng của bạn.')
    _validate_job_for_write(job)
    _validate_campaign_for_write(job.campaign, recruiter=recruiter)
    if deadline < timezone.localdate():
        raise ValidationError({'deadline': 'Hạn nộp phải từ hôm nay trở đi.'})
    job.deadline = deadline
    job.status = Job.Status.PENDING
    job.published_at = None
    job.approved_at = None
    job.closed_at = None
    job.save(
        update_fields=[
            'deadline',
            'status',
            'published_at',
            'approved_at',
            'closed_at',
            'updated_at',
        ]
    )
    _record_status(job, from_status=Job.Status.CLOSED, to_status=Job.Status.PENDING, user=user)
    return job


@transaction.atomic
def extend_job_deadline(job, user, deadline):
    recruiter = _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.ACTIVE:
        raise ValidationError('Chỉ có thể gia hạn tin đang tuyển của bạn.')
    _validate_job_for_write(job)
    _validate_campaign_for_write(job.campaign, recruiter=recruiter)
    today = timezone.localdate()
    if job.deadline is None or deadline <= job.deadline:
        raise ValidationError({'deadline': 'Hạn gia hạn phải sau hạn nộp hiện tại.'})
    if deadline > today + timedelta(days=MAX_DEADLINE_DAYS):
        raise ValidationError(
            {'deadline': f'Hạn gia hạn không được quá {MAX_DEADLINE_DAYS} ngày kể từ hôm nay.'}
        )
    if job.deadline < today - timedelta(days=EXPIRED_JOB_RENEWAL_GRACE_DAYS):
        raise ValidationError(
            {
                'deadline': (
                    'Chỉ có thể gia hạn tin hết hạn trong vòng '
                    f'{EXPIRED_JOB_RENEWAL_GRACE_DAYS} ngày.'
                )
            }
        )
    if job.published_at:
        published_date = timezone.localdate(job.published_at)
        if deadline > published_date + timedelta(days=MAX_PUBLIC_LIFETIME_DAYS):
            raise ValidationError(
                {
                    'deadline': (
                        'Tổng thời gian công khai của tin không được quá '
                        f'{MAX_PUBLIC_LIFETIME_DAYS} ngày.'
                    )
                }
            )
    if job.campaign_id:
        if job.campaign.status != job.campaign.Status.ACTIVE:
            raise ValidationError({'deadline': 'Chỉ có thể gia hạn trong chiến dịch đang chạy.'})
        if job.campaign.target_date and deadline > job.campaign.target_date:
            raise ValidationError(
                {'deadline': 'Hạn gia hạn không được sau ngày kết thúc chiến dịch.'}
            )

    was_expired = job.deadline < today
    job.deadline = deadline
    if was_expired:
        return _move_public_revision_to_review(
            job,
            user=user,
            note='Gia hạn tin đã hết hạn',
            update_fields=('deadline',),
        )
    job.save(update_fields=['deadline', 'updated_at'])
    if job.campaign_id:
        record_campaign_activity(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_UPDATED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title, 'deadline': deadline.isoformat()},
        )
    return job


@transaction.atomic
def duplicate_job(job, user):
    _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền sao chép tin này.')
    if job.policy_hold or job.moderation_hold or (job.campaign_id and job.campaign.policy_hold):
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': 'Không thể sao chép tin hoặc chiến dịch đang bị hold.',
            }
        )
    duplicate = copy(job)
    duplicate.pk = None
    duplicate.id = None
    duplicate.public_id = ''
    duplicate.slug = ''
    duplicate.status = Job.Status.DRAFT
    duplicate.submitted_at = None
    duplicate.published_at = None
    duplicate.closed_at = None
    duplicate.approved_at = None
    duplicate.rejected_reason = ''
    duplicate.policy_hold = Job.PolicyHold.NONE
    duplicate.policy_held_at = None
    duplicate.policy_hold_transition = None
    duplicate.moderation_hold = Job.ModerationHold.NONE
    duplicate.moderation_held_at = None
    duplicate.view_count = 0
    duplicate.impression_count = 0
    duplicate.application_count = 0
    duplicate.engagement_tracking_started_at = timezone.now()
    duplicate.title = f'{job.title} (bản sao)'
    duplicate.save()
    _record_job_assignment(duplicate, previous_campaign=None, user=user)
    for model, relation in (
        (JobCategoryAssignment, 'category_assignments'),
        (JobLocation, 'job_locations'),
        (JobSkill, 'job_skills'),
        (JobWorkSchedule, 'work_schedules'),
        (JobBenefit, 'job_benefits'),
        (JobLanguageRequirement, 'language_requirements'),
    ):
        model.objects.bulk_create(
            [
                model(
                    **{
                        field.attname: getattr(item, field.attname)
                        for field in model._meta.fields
                        if field.name not in {'id', 'job'}
                    },
                    job=duplicate,
                )
                for item in getattr(job, relation).all()
            ]
        )
    contact = getattr(job, 'application_contact', None)
    if contact:
        duplicate_contact = JobApplicationContact.objects.create(
            job=duplicate,
            recipient_name=contact.recipient_name,
            phone=contact.phone,
        )
        JobApplicationEmail.objects.bulk_create(
            [
                JobApplicationEmail(
                    contact=duplicate_contact,
                    email=item.email,
                    sort_order=item.sort_order,
                )
                for item in contact.emails.all()
            ]
        )
    _record_status(
        duplicate, from_status='', to_status=Job.Status.DRAFT, user=user, note='Sao chép tin'
    )
    return duplicate


@transaction.atomic
def delete_job_draft(job, user):
    """Delete one recruiter-owned draft through the workspace write boundary."""
    _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.DRAFT:
        raise ValidationError({'detail': 'Chỉ có thể xóa tin nháp của bạn.'})
    job.delete()
