from datetime import timedelta

from django.db.models import Case, CharField, ExpressionWrapper, IntegerField, Q, Value, When
from django.db.models.functions import MD5, Cast, Concat
from django.utils import timezone

from ..models import Job
from .listing import filter_job_list_queryset

DEFAULT_BEST_JOBS_ROTATION_SEED = 'homepage-best-jobs'

# Điểm "Việc làm tốt nhất" theo điều ứng viên quan tâm, thay cho hạng tin trả phí
# (TOP) đã bỏ cùng dịch vụ thương mại. Giữ ít tiêu chí để giải thích được.
SALARY_DISCLOSED_POINTS = 3
HOT_OR_URGENT_POINTS = 2
FRESH_WEEK_POINTS = 2
FRESH_MONTH_POINTS = 1
POPULAR_POINTS = 1
POPULAR_MIN_APPLICATIONS = 5


def best_job_score(at):
    """Điểm chất lượng của tin: lương công khai, nhãn HOT/GẤP, độ mới, độ quan tâm."""
    return (
        Case(
            When(
                ~Q(salary_type=Job.SalaryType.NEGOTIABLE) & Q(salary_type__isnull=False),
                then=Value(SALARY_DISCLOSED_POINTS),
            ),
            default=Value(0),
        )
        + Case(
            When(Q(is_hot=True) | Q(is_urgent=True), then=Value(HOT_OR_URGENT_POINTS)),
            default=Value(0),
        )
        + Case(
            When(published_at__gte=at - timedelta(days=7), then=Value(FRESH_WEEK_POINTS)),
            When(published_at__gte=at - timedelta(days=30), then=Value(FRESH_MONTH_POINTS)),
            default=Value(0),
        )
        + Case(
            When(application_count__gte=POPULAR_MIN_APPLICATIONS, then=Value(POPULAR_POINTS)),
            default=Value(0),
        )
    )


def build_homepage_best_jobs_queryset(params, *, at=None, rotation_seed=''):
    """Every active job for the home page Best Jobs box, best first.

    Jobs are ordered by `best_job_score`; jobs with the same score rotate by a
    deterministic seed so each visit shows a different selection while
    pagination stays stable for one visitor.
    """
    at = at or timezone.now()
    queryset = filter_job_list_queryset(params, include_preview=True, at=at)
    seed = rotation_seed or DEFAULT_BEST_JOBS_ROTATION_SEED
    return queryset.alias(
        best_job_score=ExpressionWrapper(best_job_score(at), output_field=IntegerField()),
        homepage_rotation_key=MD5(
            Concat(
                Value(seed),
                Value(':'),
                Cast('pk', output_field=CharField()),
            )
        ),
    ).order_by('-best_job_score', 'homepage_rotation_key', 'id')
