"""Đọc hội thoại theo góc nhìn một phía; mọi truy vấn đều lọc theo người gọi."""

from django.db.models import Exists, F, OuterRef, Prefetch, Q

from apps.applications.models import Application, CandidateBlock
from apps.applications.selectors import candidate_published_history_queryset
from apps.cvs.models import UserCv
from apps.employers.models import RecruiterProfile
from apps.jobs.models import Job

from ..domain import Role
from ..models import Conversation, Message

MESSAGE_PAGE_MAX = 50


def _owned(role, user):
    return Q(candidate=user) if role == Role.CANDIDATE else Q(job__posted_by=user)


def _base():
    return (
        Conversation.objects.select_related(
            'job__company', 'job__posted_by', 'company', 'candidate'
        )
        .prefetch_related('job__job_locations__location__parent')
        .annotate(
            is_blocked=Exists(
                CandidateBlock.objects.filter(
                    CandidateBlock.active_q(),
                    company_id=OuterRef('company_id'),
                    candidate_id=OuterRef('candidate_id'),
                )
            )
        )
    )


def conversations_for(user, role, *, query=''):
    # Bấm "Nhắn tin" mà chưa gửi gì thì hội thoại chưa có hoạt động: không hiện ở danh
    # sách hai bên (vẫn mở được theo mã để soạn tin đầu tiên).
    queryset = _base().filter(_owned(role, user), last_message_at__isnull=False)
    query = (query or '').strip()
    if query:
        other = (
            Q(company__company_name__icontains=query)
            if role == Role.CANDIDATE
            else Q(candidate__full_name__icontains=query)
        )
        queryset = queryset.filter(Q(job__title__icontains=query) | other)
    return queryset.order_by(F('last_message_at').desc(nulls_last=True), '-created_at')


def conversation_for(user, role, public_id, *, for_update=False):
    """Hội thoại của đúng người gọi, hoặc None (không lộ hội thoại của người khác)."""
    queryset = _base() if not for_update else Conversation.objects.select_for_update(of=('self',))
    return queryset.filter(_owned(role, user), public_id=public_id).first()


def current_applications(conversations):
    """``{(job_id, candidate_id): Application}`` hồ sơ hiện hành của các hội thoại, một truy vấn."""
    rows = list(conversations)
    if not rows:
        return {}
    applications = Application.objects.filter(
        is_current=True,
        job_id__in={row.job_id for row in rows},
        candidate_id__in={row.candidate_id for row in rows},
    ).prefetch_related(Prefetch('status_history', queryset=candidate_published_history_queryset()))
    return {(item.job_id, item.candidate_id): item for item in applications}


def messages_page(conversation, *, before=None, after=None, limit=30):
    limit = max(1, min(int(limit or 30), MESSAGE_PAGE_MAX))
    queryset = conversation.messages.select_related('interview', 'cv_version')
    if after is not None:
        rows = list(queryset.filter(seq__gt=after).order_by('seq')[: limit + 1])
        return rows[:limit], len(rows) > limit
    if before is not None:
        queryset = queryset.filter(seq__lt=before)
    rows = list(queryset.order_by('-seq')[: limit + 1])
    return list(reversed(rows[:limit])), len(rows) > limit


def message_for(conversation, public_id):
    return (
        Message.objects.select_related('cv_version', 'interview')
        .filter(conversation=conversation, public_id=public_id)
        .first()
    )


def unread_conversation_count(user, role):
    field = 'candidate_unread__gt' if role == Role.CANDIDATE else 'recruiter_unread__gt'
    return Conversation.objects.filter(_owned(role, user), **{field: 0}).count()


def applied_jobs_for_candidate(user, limit=50):
    """Hồ sơ hiện hành (chưa rút) kèm hội thoại đã có: cột "Tin tuyển dụng đã ứng tuyển"."""
    applications = list(
        Application.objects.filter(candidate=user, is_current=True)
        .exclude(status=Application.Status.WITHDRAWN)
        .select_related('job__company')
        .order_by('-applied_at')[:limit]
    )
    existing = dict(
        Conversation.objects.filter(
            candidate=user, job_id__in=[item.job_id for item in applications]
        ).values_list('job_id', 'public_id')
    )
    blocked = set(
        CandidateBlock.objects.filter(CandidateBlock.active_q(), candidate=user).values_list(
            'company_id', flat=True
        )
    )
    return [
        (application, existing.get(application.job_id), application.job.company_id not in blocked)
        for application in applications
    ]


def shareable_cvs(user, limit=30):
    return (
        UserCv.objects.filter(user=user, is_deleted=False, latest_version__isnull=False)
        .exclude(lifecycle_status=UserCv.LifecycleStatus.ARCHIVED)
        .order_by('-updated_at')[:limit]
    )


def shareable_jobs(user, limit=50):
    company_ids = RecruiterProfile.objects.filter(user=user, company__isnull=False).values(
        'company_id'
    )
    return (
        Job.publicly_available_queryset()
        .filter(company_id__in=company_ids)
        .select_related('company')
        .prefetch_related('job_locations__location__parent')
        .order_by('-published_at')[:limit]
    )


def personal_messages(user):
    """Tin người dùng đã gửi trong ProCV Connect, cho bản xuất dữ liệu cá nhân."""
    return [
        {
            'job_title': message.conversation.job.title,
            'company_name': message.conversation.company.company_name,
            'kind': message.kind,
            'body': message.body,
            'file_name': message.attachment_name,
            'created_at': message.created_at,
        }
        for message in Message.objects.filter(sender=user, erased_at__isnull=True)
        .select_related('conversation__job', 'conversation__company')
        .order_by('created_at')
    ]
