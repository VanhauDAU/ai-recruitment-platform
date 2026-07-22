"""Job-posting mutation workflows owned by the recruiter who created the job."""

from copy import copy

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.employers.models import RecruiterProfile
from apps.employers.services import recruiter_posting_readiness
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


def _locked_recruiter(user):
    recruiter = RecruiterProfile.objects.select_for_update().filter(user=user).first()
    if recruiter is None or recruiter.company_id is None:
        raise ValidationError('Cập nhật thông tin công ty trước khi đăng tin.')
    return recruiter


def _free_job_quota():
    return max(get_int_setting('employer_free_job_quota', FREE_JOB_QUOTA), 0)


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


def _validate_publishable(job):
    errors = {}
    if not job.title.strip():
        errors['title'] = 'Nhập tiêu đề tin tuyển dụng.'
    if not job.description.strip():
        errors['description'] = 'Nhập mô tả công việc.'
    if not job.number_of_vacancies or job.number_of_vacancies < 1:
        errors['number_of_vacancies'] = 'Số lượng tuyển phải từ 1 trở lên.'
    if not job.job_locations.exists():
        errors['job_locations'] = 'Thêm ít nhất một địa điểm làm việc.'
    if not job.category_assignments.filter(
        role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
    ).exists():
        errors['category_assignments'] = 'Chọn một vị trí chuyên môn chính.'
    if job.deadline is None or job.deadline < timezone.localdate():
        errors['deadline'] = 'Hạn nộp phải từ hôm nay trở đi.'
    if errors:
        raise ValidationError(errors)


def employer_job_posting_context(user):
    _, verified = recruiter_posting_readiness(user)
    limit = _free_job_quota()
    count = Job.objects.filter(posted_by=user, submitted_at__isnull=False).count()
    reason = ''
    if not verified:
        reason = 'Hoàn tất các bước xác thực tài khoản trước khi đăng tin.'
    elif count >= limit:
        reason = 'Bạn đã dùng hết lượt đăng tin miễn phí.'
    return {
        'verification_completed': verified,
        'published_jobs_count': count,
        'free_publish_limit': limit,
        'free_publish_remain': max(limit - count, 0),
        'job_postable': verified and count < limit,
        'approval_required': True,
        'block_reason': reason,
    }


@transaction.atomic
def save_job_draft(serializer, user):
    """Persist a partial job form; drafts never consume a publication credit."""
    recruiter = _locked_recruiter(user)
    if serializer.instance is None:
        job = serializer.save(posted_by=user, company=recruiter.company, status=Job.Status.DRAFT)
        _record_status(job, from_status='', to_status=Job.Status.DRAFT, user=user)
        return job
    if serializer.instance.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền lưu nháp tin này.')
    return serializer.save()


@transaction.atomic
def publish_job(job, user):
    """Submit a recruiter-owned job to the mandatory admin review queue."""
    _locked_recruiter(user)
    if job.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền gửi duyệt tin này.')
    if job.status == Job.Status.CLOSED:
        raise ValidationError('Mở lại tin trước khi gửi duyệt lại.')
    _validate_publishable(job)
    _, verified = recruiter_posting_readiness(user)
    if not verified:
        raise ValidationError(
            {'detail': 'Hoàn tất 5 bước xác thực tài khoản trước khi gửi tin duyệt.'}
        )
    if job.submitted_at is None:
        limit = _free_job_quota()
        used = Job.objects.filter(posted_by=user, submitted_at__isnull=False).count()
        if used >= limit:
            raise ValidationError({'detail': 'Bạn đã dùng hết lượt đăng tin miễn phí.'})
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
    if serializer.instance.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền chỉnh sửa tin này.')
    return serializer.save()


@transaction.atomic
def close_job(job, user):
    if job.posted_by_id != user.id or job.status != Job.Status.ACTIVE:
        raise ValidationError('Chỉ có thể đóng tin đang tuyển của bạn.')
    job.status = Job.Status.CLOSED
    job.closed_at = timezone.now()
    job.save(update_fields=['status', 'closed_at', 'updated_at'])
    _record_status(job, from_status=Job.Status.ACTIVE, to_status=Job.Status.CLOSED, user=user)
    return job


@transaction.atomic
def reopen_job(job, user, deadline):
    if job.posted_by_id != user.id or job.status != Job.Status.CLOSED:
        raise ValidationError('Chỉ có thể mở lại tin đã đóng của bạn.')
    if deadline < timezone.localdate():
        raise ValidationError({'deadline': 'Hạn nộp phải từ hôm nay trở đi.'})
    _, verified = recruiter_posting_readiness(user)
    if not verified:
        raise ValidationError(
            {'detail': 'Hoàn tất 5 bước xác thực tài khoản trước khi gửi tin duyệt.'}
        )
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
    if job.posted_by_id != user.id or job.status != Job.Status.ACTIVE:
        raise ValidationError('Chỉ có thể gia hạn tin đang tuyển của bạn.')
    if deadline < timezone.localdate():
        raise ValidationError({'deadline': 'Hạn nộp phải từ hôm nay trở đi.'})
    job.deadline = deadline
    job.save(update_fields=['deadline', 'updated_at'])
    return job


@transaction.atomic
def duplicate_job(job, user):
    if job.posted_by_id != user.id:
        raise ValidationError('Bạn không có quyền sao chép tin này.')
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
    duplicate.view_count = 0
    duplicate.application_count = 0
    duplicate.title = f'{job.title} (bản sao)'
    duplicate.save()
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
