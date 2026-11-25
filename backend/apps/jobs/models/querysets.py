"""Pure job-query primitives shared by selectors and delivery services."""

from django.apps import apps
from django.conf import settings
from django.db import models
from django.db.models import (
    BooleanField,
    Case,
    CharField,
    Count,
    Exists,
    F,
    Func,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.translation import gettext, gettext_lazy

from common.vietnam_time import vietnam_today

from .core import Job

SALARY_BUCKETS = [
    ('u10', gettext_lazy('Dưới 10 triệu'), None, 10_000_000),
    ('10-15', gettext_lazy('10 - 15 triệu'), 10_000_000, 15_000_000),
    ('15-20', gettext_lazy('15 - 20 triệu'), 15_000_000, 20_000_000),
    ('20-25', gettext_lazy('20 - 25 triệu'), 20_000_000, 25_000_000),
    ('25-30', gettext_lazy('25 - 30 triệu'), 25_000_000, 30_000_000),
    ('30-50', gettext_lazy('30 - 50 triệu'), 30_000_000, 50_000_000),
    ('o50', gettext_lazy('Trên 50 triệu'), 50_000_000, None),
]


def listing_recency():
    """Mốc xếp hạng duy nhất trên mọi bề mặt công khai: lần đăng đầu (ADR-0030).

    ``published_at`` đổi khi mở lại tin nên không dùng để xếp hạng; bản Python
    là ``Job.listing_recency_at``.
    """
    return Coalesce('first_approved_at', 'published_at', 'created_at')


class JobState(models.TextChoices):
    """Effective state of a job as candidates experience it."""

    DRAFT = 'draft', gettext_lazy('Nháp')
    ACTIVE = 'active', gettext_lazy('Đang tuyển')
    HIDDEN = 'hidden', gettext_lazy('Bị ẩn')
    EXPIRED = 'expired', gettext_lazy('Hết hạn')
    CLOSED = 'closed', gettext_lazy('Ngừng tuyển')


_RECRUITER = 'posted_by__recruiter_profile__'
_NEVER = Q(pk__isnull=True)


def _active_hold(model_name, **outer_refs):
    """Correlated EXISTS of an active compliance hold; safe in filter() and When()."""
    links = apps.get_model('employers', model_name).objects.filter(
        **{field: OuterRef(ref) for field, ref in outer_refs.items()}
    )
    status = 'status' if model_name == 'EmployerComplianceHold' else 'hold__status'
    return Exists(links.filter(**{status: 'active'}))


def _poster_dpa_current():
    """SQL twin of ``current_dpa_status(...) == CURRENT``; fails closed on bad config."""
    version = settings.EMPLOYER_DPA_POLICY_VERSION
    digest = settings.EMPLOYER_DPA_DOCUMENT_SHA256
    if not version or len(digest) != 64:
        return _NEVER
    return Q(
        **{
            f'{_RECRUITER}dpa_accepted_at__isnull': False,
            f'{_RECRUITER}dpa_policy_version': version,
            f'{_RECRUITER}dpa_document_sha256': digest,
        }
    )


def _visibility_requirements():
    """Ordered ``(code, label, action, condition)``: the job is hidden while any fails.

    The poster checks mirror ``candidate_data_access`` of the employer readiness
    policy, so a job only takes applications the employer is allowed to open.
    Workspace evidence (phone, documents) is a publish-time gate and is not
    repeated per row.
    """
    return (
        (
            'moderation_hold',
            gettext('Quản trị viên đang tạm ẩn tin để kiểm duyệt.'),
            'contact_support',
            Q(moderation_hold=Job.ModerationHold.NONE),
        ),
        (
            'account_hold',
            gettext('Tin đang bị tạm giữ theo trạng thái tài khoản.'),
            'contact_support',
            Q(policy_hold=Job.PolicyHold.NONE),
        ),
        (
            'job_compliance_hold',
            gettext('Tin đang bị giữ để rà soát tuân thủ.'),
            'contact_support',
            ~_active_hold('EmployerComplianceHoldJob', job_id='pk'),
        ),
        (
            'account_inactive',
            gettext('Tài khoản đăng tin không còn hoạt động.'),
            'contact_support',
            Q(posted_by__status='active', posted_by__is_active=True, posted_by__is_deleted=False),
        ),
        (
            'left_company',
            gettext('Tài khoản đăng tin không còn thuộc công ty của tin.'),
            'contact_support',
            Q(**{f'{_RECRUITER}company_id': F('company_id')}),
        ),
        (
            'verification_required',
            gettext('Tài khoản chưa được duyệt xác thực cho công ty này.'),
            'open_verification',
            Q(
                **{
                    f'{_RECRUITER}verification_case__status': 'approved',
                    f'{_RECRUITER}verification_case__company_id': F('company_id'),
                }
            ),
        ),
        (
            'dpa_required',
            gettext('Thỏa thuận xử lý dữ liệu ứng viên (DPA) chưa ở phiên bản hiện hành.'),
            'accept_current_dpa',
            _poster_dpa_current(),
        ),
        (
            'account_compliance_hold',
            gettext('Tài khoản đang bị giữ để rà soát tuân thủ.'),
            'contact_support',
            ~_active_hold('EmployerComplianceHold', recruiter_id=f'{_RECRUITER}pk'),
        ),
        (
            'company_hidden',
            gettext('Trang công ty đang bị tạm ẩn theo chính sách nội dung.'),
            'contact_support',
            Q(company__content_policy_hold=False),
        ),
        (
            'campaign_unavailable',
            gettext('Chiến dịch chứa tin đang tạm dừng, đã kết thúc hoặc bị giữ.'),
            'open_campaign',
            Q(campaign__isnull=True)
            | (
                Q(
                    campaign__status='active',
                    campaign__policy_hold='',
                    campaign__owner__user__status='active',
                    campaign__owner__user__is_active=True,
                    campaign__owner__user__is_deleted=False,
                )
                & ~_active_hold('EmployerComplianceHoldCampaign', campaign_id='campaign_id')
            ),
        ),
    )


def _time_requirements(now):
    today = vietnam_today(now)
    return (
        (
            'deadline_passed',
            gettext('Đã quá hạn nộp hồ sơ.'),
            'extend_deadline',
            Q(deadline__isnull=True) | Q(deadline__gte=today),
        ),
        (
            'visibility_ended',
            gettext('Đã hết thời gian hiển thị tin.'),
            'extend_deadline',
            Q(visibility_starts_at__lte=now, visibility_ends_at__gt=now),
        ),
    )


def _all_of(requirements):
    condition = Q()
    for *_, requirement in requirements:
        condition &= requirement
    return condition


def job_public_time_filter(*, now=None):
    """Application deadline (Vietnam calendar) and the public visibility window."""
    return _all_of(_time_requirements(now or timezone.now()))


def publicly_available_job_filter(*, at=None):
    """One canonical availability predicate for every candidate-facing path."""
    return (
        Q(status=Job.Status.ACTIVE)
        & _all_of(_visibility_requirements())
        & job_public_time_filter(now=at)
    )


def stopped_job_filter(*, at=None):
    """Jobs that stopped recruiting (closed or past their dates) but are not held.

    Candidates may still open them, e.g. from their application history, to
    see what they applied to; they never take applications.
    """
    now = at or timezone.now()
    return _all_of(_visibility_requirements()) & (
        Q(status=Job.Status.CLOSED)
        | (Q(status=Job.Status.ACTIVE) & ~job_public_time_filter(now=now))
    )


def job_effective_state_expression(*, at=None):
    """``JobState`` of each row; held beats expired because extending cannot fix it."""
    now = at or timezone.now()
    unblocked = _all_of(_visibility_requirements())
    return Case(
        When(status=Job.Status.DRAFT, then=Value(JobState.DRAFT)),
        When(status=Job.Status.CLOSED, then=Value(JobState.CLOSED)),
        When(unblocked & job_public_time_filter(now=now), then=Value(JobState.ACTIVE)),
        When(unblocked, then=Value(JobState.EXPIRED)),
        default=Value(JobState.HIDDEN),
        output_field=CharField(),
    )


def with_job_visibility(queryset, *, at=None):
    """Annotate ``effective_state`` plus one ``visibility_issue_<code>`` flag per rule.

    List pages read every reason from the same row, so explaining a hidden job
    costs no extra query per job.
    """
    now = at or timezone.now()
    flags = {
        f'visibility_issue_{code}': Case(
            When(condition, then=Value(False)), default=Value(True), output_field=BooleanField()
        )
        for code, _, _, condition in (*_visibility_requirements(), *_time_requirements(now))
    }
    return queryset.annotate(effective_state=job_effective_state_expression(at=now), **flags)


def job_visibility_issues(job, *, at=None):
    """Why candidates cannot see ``job`` now: ``[{code, label, action}]``, empty when public.

    Reads the annotations of ``with_job_visibility`` when present, otherwise
    loads them in one query.
    """
    now = at or timezone.now()
    requirements = (*_visibility_requirements(), *_time_requirements(now))
    if not hasattr(job, 'visibility_issue_moderation_hold'):
        row = with_job_visibility(Job.objects.filter(pk=job.pk), at=now).values(
            'effective_state', *(f'visibility_issue_{code}' for code, *_ in requirements)
        )[0]
        for key, value in row.items():
            setattr(job, key, value)
    if job.effective_state not in (JobState.HIDDEN, JobState.EXPIRED):
        return []
    return [
        {'code': code, 'label': label, 'action': action}
        for code, label, action, _ in requirements
        if getattr(job, f'visibility_issue_{code}')
    ]


def job_state_count_subquery(state, **outer_refs):
    """Correlated count of jobs in ``state``, e.g. ``campaign_id='pk'`` per campaign."""
    jobs = (
        Job.objects.filter(**{field: OuterRef(ref) for field, ref in outer_refs.items()})
        .alias(effective_state=job_effective_state_expression())
        .filter(effective_state=state)
        .order_by()
        .annotate(total=Func(F('id'), function='COUNT'))
        .values('total')
    )
    return Coalesce(Subquery(jobs, output_field=IntegerField()), 0)


def job_state_counts(queryset, *, at=None):
    """``{state: count}`` for every ``JobState`` in one aggregate query."""
    state = job_effective_state_expression(at=at)
    return queryset.alias(effective_state=state).aggregate(
        **{value: Count('id', filter=Q(effective_state=value)) for value in JobState.values}
    )


def salary_bucket_condition(bucket_key):
    """``Q`` of one homepage salary band over the ``salary_bucket_value`` annotation.

    The band is judged on the displayed upper salary (``salary_max``, else
    ``salary_min``); negotiable and undisclosed salaries belong to no band.
    Annotate the queryset with ``SALARY_BUCKET_VALUE`` before using it, which
    lets one aggregate count every band at once.
    """
    bucket = next((item for item in SALARY_BUCKETS if item[0] == bucket_key), None)
    if not bucket:
        raise ValueError('Invalid salary bucket.')

    _, _, lower, upper = bucket
    condition = ~Q(salary_type=Job.SalaryType.NEGOTIABLE) & Q(salary_bucket_value__isnull=False)
    if lower is not None:
        condition &= Q(salary_bucket_value__gt=lower)
    if upper is not None:
        condition &= Q(salary_bucket_value__lte=upper)
    return condition


SALARY_BUCKET_VALUE = Coalesce('salary_max', 'salary_min')


def filter_salary_bucket_queryset(queryset, bucket_key):
    """Preserve the public homepage bucket contract based on displayed upper salary."""
    condition = salary_bucket_condition(bucket_key)
    return queryset.annotate(salary_bucket_value=SALARY_BUCKET_VALUE).filter(condition)


def filter_alert_salary_bucket_queryset(queryset, bucket_key):
    """Match a VND alert range by overlap, exactly like the public salary range URL."""
    bucket = next((item for item in SALARY_BUCKETS if item[0] == bucket_key), None)
    if not bucket:
        raise ValueError('Invalid salary bucket.')

    _, _, lower, upper = bucket
    queryset = queryset.filter(currency=Job.Currency.VND).exclude(
        salary_type=Job.SalaryType.NEGOTIABLE
    )
    if lower is not None:
        queryset = queryset.filter(
            Q(salary_max__gte=lower) | Q(salary_max__isnull=True, salary_min__gte=lower)
        )
    if upper is not None:
        queryset = queryset.filter(
            Q(salary_min__lte=upper) | Q(salary_min__isnull=True, salary_max__lte=upper)
        )
    queryset = queryset.exclude(salary_min__isnull=True, salary_max__isnull=True)
    return queryset


def active_jobs_queryset(include_preview=False, *, at=None):
    """Public jobs with relations needed by candidate-facing response and mail paths."""
    relations = [
        'category_assignments__category',
        'job_locations__location__parent',
        'job_skills__skill',
    ]
    if include_preview:
        relations.extend(['job_benefits__benefit', 'work_schedules'])
    queryset = (
        Job.objects.filter(publicly_available_job_filter(at=at))
        .select_related('company', 'campaign', 'posted_by', 'posted_by__recruiter_profile')
        .prefetch_related(*relations)
    )
    if not include_preview:
        queryset = queryset.defer(
            'description',
            'requirements',
            'benefits',
            'work_schedule_note',
        )
    return queryset
