from datetime import timedelta

from django.db.models import Case, CharField, Count, ExpressionWrapper, IntegerField, Q, Value, When
from django.db.models.functions import MD5, Cast, Coalesce, Concat
from django.utils import timezone

from apps.locations.models import Location

from ..models import Job, JobLocation, listing_recency
from .listing import filter_job_list_queryset, publicly_available_job_filter

DEFAULT_BEST_JOBS_ROTATION_SEED = 'homepage-best-jobs'

# Điểm "Việc làm nổi bật" chỉ từ dữ liệu thật của tin, không hạng trả phí hay nhãn
# gán tay (ADR-0030). Giữ ít tiêu chí để giải thích được; tin cũ mà tốt vẫn có lượt.
SALARY_DISCLOSED_POINTS = 3
# Huy hiệu Sấm Chớp: người đăng thật sự trả lời ứng viên đúng hạn (ADR-0027).
FLASH_BADGE_POINTS = 2
FRESH_WEEK_POINTS = 2
FRESH_MONTH_POINTS = 1
POPULAR_POINTS = 1
POPULAR_MIN_APPLICATIONS = 5


def best_job_score(at):
    """Điểm chất lượng của tin: lương công khai, Sấm Chớp, độ mới, độ quan tâm."""
    return (
        Case(
            When(
                ~Q(salary_type=Job.SalaryType.NEGOTIABLE) & Q(salary_type__isnull=False),
                then=Value(SALARY_DISCLOSED_POINTS),
            ),
            default=Value(0),
        )
        + Case(When(has_flash_badge=True, then=Value(FLASH_BADGE_POINTS)), default=Value(0))
        + Case(
            When(listing_recency__gte=at - timedelta(days=7), then=Value(FRESH_WEEK_POINTS)),
            When(listing_recency__gte=at - timedelta(days=30), then=Value(FRESH_MONTH_POINTS)),
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
    return (
        queryset.alias(listing_recency=listing_recency())
        .alias(
            best_job_score=ExpressionWrapper(best_job_score(at), output_field=IntegerField()),
            homepage_rotation_key=MD5(
                Concat(
                    Value(seed),
                    Value(':'),
                    Cast('pk', output_field=CharField()),
                )
            ),
        )
        .order_by('-best_job_score', 'homepage_rotation_key', 'id')
    )


HOMEPAGE_LOCATION_WARD_LIMIT = 15


def homepage_best_job_locations(*, at=None, ward_limit=HOMEPAGE_LOCATION_WARD_LIMIT):
    """Tỉnh và phường/xã đang có tin công khai, kèm số tin, nhiều tin trước.

    Bộ lọc địa điểm của box "Việc làm nổi bật" chỉ đưa ra nơi bấm vào có kết quả.
    Một tin gắn nhiều phường cùng tỉnh chỉ được đếm một lần cho tỉnh đó; liên kết
    tỉnh cũ (trước khi bắt buộc chọn phường) vẫn được tính cho tỉnh.
    """
    public_jobs = Job.objects.filter(publicly_available_job_filter(at=at or timezone.now()))
    workplaces = JobLocation.objects.filter(job__in=public_jobs.values('pk'))
    provinces = list(
        workplaces.annotate(province_id=Coalesce('location__parent_id', 'location_id'))
        .values('province_id')
        .annotate(job_count=Count('job_id', distinct=True))
        .order_by('-job_count', 'province_id')
    )
    wards = list(
        workplaces.filter(location__level=Location.Level.WARD)
        .values('location_id')
        .annotate(job_count=Count('job_id', distinct=True))
        .order_by('-job_count', 'location_id')[:ward_limit]
    )
    locations = Location.objects.select_related('parent').in_bulk(
        [row['province_id'] for row in provinces] + [row['location_id'] for row in wards]
    )
    return {
        'provinces': [
            {'id': row['province_id'], 'name': location.name, 'job_count': row['job_count']}
            for row in provinces
            if (location := locations.get(row['province_id']))
        ],
        'wards': [
            {
                'id': row['location_id'],
                'name': location.name,
                'parent_id': location.parent_id,
                'parent_name': location.parent.name if location.parent else '',
                'job_count': row['job_count'],
            }
            for row in wards
            if (location := locations.get(row['location_id']))
        ],
    }
