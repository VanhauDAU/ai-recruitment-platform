import unicodedata
from datetime import timedelta

from django.contrib.postgres.aggregates import StringAgg
from django.db.models import Count, F, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate, IsEmployer
from common.media_storage import media_url_from_value
from apps.employers.models import EmployerProfile

from .models import Job, JobCategory, SavedJob
from .serializers import JobCategorySerializer, JobSerializer, SavedJobSerializer


SALARY_BUCKETS = [
    ('u10', 'Dưới 10 triệu', None, 10_000_000),
    ('10-15', '10 - 15 triệu', 10_000_000, 15_000_000),
    ('15-20', '15 - 20 triệu', 15_000_000, 20_000_000),
    ('20-25', '20 - 25 triệu', 20_000_000, 25_000_000),
    ('25-30', '25 - 30 triệu', 25_000_000, 30_000_000),
    ('30-50', '30 - 50 triệu', 30_000_000, 50_000_000),
    ('o50', 'Trên 50 triệu', 50_000_000, None),
]


def search_q(field, text):
    """Tìm kiếm kiểu: không dấu (unaccent 2 phía) + AND từng từ, nên nhập
    "khach hang cham soc" vẫn khớp "Chăm sóc khách hàng"."""
    q = Q()
    for token in text.split():
        q &= Q(**{f'{field}__unaccent__icontains': token})
    return q


def fold_accents(text):
    """Bỏ dấu tiếng Việt phía Python (xếp hạng gợi ý): 'Chăm sóc' -> 'cham soc'."""
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c)).lower()


def filter_salary_bucket(qs, bucket_key):
    """Homepage salary chips: bucket jobs by their displayed upper salary.

    This avoids "Dưới 10 triệu" showing jobs like 10-25tr just because their
    lower bound intersects 10tr.
    """

    bucket = next((item for item in SALARY_BUCKETS if item[0] == bucket_key), None)
    if not bucket:
        raise ValidationError({'salary_bucket': 'Invalid salary bucket.'})

    _, _, lower, upper = bucket
    qs = (
        qs.filter(is_salary_visible=True)
        .exclude(salary_min__isnull=True, salary_max__isnull=True)
        .annotate(salary_bucket_value=Coalesce('salary_max', 'salary_min'))
    )
    if lower is not None:
        qs = qs.filter(salary_bucket_value__gt=lower)
    if upper is not None:
        qs = qs.filter(salary_bucket_value__lte=upper)
    return qs


class JobCategoryListView(generics.ListAPIView):
    serializer_class = JobCategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE)


class JobListView(generics.ListAPIView):
    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Job.objects.filter(status=Job.Status.ACTIVE).select_related('employer_profile').prefetch_related('locations')
        params = self.request.query_params
        # Accepts multiple ?category= values at any taxonomy level;
        # a group/nghề id also matches jobs tagged with its descendants.
        if categories := params.getlist('category'):
            ids = [int(c) for c in categories if c.isdigit()]
            children = list(JobCategory.objects.filter(parent_id__in=ids).values_list('id', flat=True))
            grandchildren = list(JobCategory.objects.filter(parent_id__in=children).values_list('id', flat=True))
            qs = qs.filter(category_id__in=[*ids, *children, *grandchildren])
        # Accepts multiple ?location= values; each id may be a province or a ward.
        # A province id matches jobs at any of its wards (location.parent) or the province itself.
        if locations := params.getlist('location'):
            qs = qs.filter(Q(locations__id__in=locations) | Q(locations__parent_id__in=locations)).distinct()
        if work_type := params.get('work_type'):
            qs = qs.filter(work_type=work_type)
        if employment_type := params.get('employment_type'):
            qs = qs.filter(employment_type=employment_type)
        if experience_level := params.get('experience_level'):
            qs = qs.filter(experience_level=experience_level)
        if education_level := params.get('education_level'):
            qs = qs.filter(education_level=education_level)
        # Bộ lọc: cấp bậc, kinh nghiệm theo năm (chọn nhiều),
        # chế độ thứ 7 ('not_mentioned' = tin không đề cập), lĩnh vực công ty.
        if position_level := params.get('position_level'):
            qs = qs.filter(position_level=position_level)
        if experience_years := params.getlist('experience_years'):
            qs = qs.filter(experience_years__in=experience_years)
        if weekend := params.get('weekend_policy'):
            qs = qs.filter(weekend_policy='' if weekend == 'not_mentioned' else weekend)
        # industries là M2M (1 công ty có thể nhiều lĩnh vực) — filter vẫn single-select
        # theo id, match job nếu công ty có lĩnh vực đó trong số các lĩnh vực của mình.
        if industry := params.get('industry'):
            qs = qs.filter(employer_profile__industries__id=industry)
        if params.get('salary_negotiable') in ['1', 'true', 'True']:
            qs = qs.filter(Q(is_salary_visible=False) | (Q(salary_min__isnull=True) & Q(salary_max__isnull=True)))
        elif salary_bucket := params.get('salary_bucket'):
            qs = filter_salary_bucket(qs, salary_bucket)
        else:
            # Salary range overlap (values in VND): a job matches when its band
            # intersects [salary_gte, salary_lte]. Used by the advanced job list.
            if salary_gte := params.get('salary_gte'):
                qs = qs.filter(Q(salary_max__gte=salary_gte) | Q(salary_max__isnull=True, salary_min__gte=salary_gte))
            if salary_lte := params.get('salary_lte'):
                qs = qs.filter(Q(salary_min__lte=salary_lte) | Q(salary_min__isnull=True, salary_max__lte=salary_lte))
        if search := params.get('search'):
            # search_by: 'title' (mặc định) | 'company' | 'both'
            search_by = params.get('search_by', 'title')
            if search_by == 'company':
                qs = qs.filter(search_q('employer_profile__company_name', search))
            elif search_by == 'both':
                qs = qs.filter(
                    search_q('title', search) | search_q('employer_profile__company_name', search)
                )
            else:
                qs = qs.filter(search_q('title', search))
        # ?ordering=salary_desc — lương cao nhất trước (job thoả thuận xếp cuối).
        if params.get('ordering') == 'salary_desc':
            return qs.order_by(F('salary_max').desc(nulls_last=True), '-published_at')
        return qs.order_by('-published_at', '-created_at')


class JobStatsView(APIView):
    """Aggregate stats for the homepage market dashboard (public)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary='Thống kê thị trường việc làm (dashboard trang chủ)',
        responses=inline_serializer(
            'JobStats',
            fields={
                'active_jobs': serializers.IntegerField(),
                'companies': serializers.IntegerField(),
                'new_jobs_24h': serializers.IntegerField(),
                'growth': inline_serializer('JobStatsGrowth', many=True, fields={
                    'date': serializers.CharField(),
                    'count': serializers.IntegerField(),
                }),
                'demand': inline_serializer('JobStatsDemand', many=True, fields={
                    'id': serializers.IntegerField(),
                    'name': serializers.CharField(),
                    'slug': serializers.CharField(),
                    'logo_url': serializers.CharField(allow_blank=True),
                    'count': serializers.IntegerField(),
                }),
                'salary_demand': inline_serializer('JobStatsSalaryDemand', many=True, fields={
                    'name': serializers.CharField(),
                    'count': serializers.IntegerField(),
                }),
                'latest_jobs': inline_serializer('JobStatsLatest', many=True, fields={
                    'public_id': serializers.CharField(),
                    'slug': serializers.CharField(),
                    'title': serializers.CharField(),
                    'company_name': serializers.CharField(),
                    'location_name': serializers.CharField(),
                    'location_names': serializers.ListField(child=serializers.CharField()),
                    'work_type': serializers.CharField(allow_blank=True),
                    'employment_type': serializers.CharField(allow_blank=True),
                    'experience_level': serializers.CharField(allow_blank=True),
                    'salary_min': serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True),
                    'salary_max': serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True),
                    'currency': serializers.CharField(),
                    'is_salary_visible': serializers.BooleanField(),
                    'number_of_vacancies': serializers.IntegerField(allow_null=True),
                    'deadline': serializers.DateField(allow_null=True),
                    'published_at': serializers.DateTimeField(allow_null=True),
                    'short_description': serializers.CharField(allow_blank=True),
                }),
                'featured_employers': inline_serializer('JobStatsFeaturedEmployer', many=True, fields={
                    'id': serializers.IntegerField(),
                    'public_id': serializers.CharField(),
                    'company_name': serializers.CharField(),
                    'slug': serializers.CharField(),
                    'company_logo_url': serializers.CharField(allow_blank=True),
                    'industry': serializers.CharField(allow_blank=True),
                    'job_count': serializers.IntegerField(),
                }),
            },
        ),
        tags=['jobs'],
    )
    def get(self, request):
        now = timezone.now()
        active = Job.objects.filter(status=Job.Status.ACTIVE).annotate(
            published=Coalesce('published_at', 'created_at')
        )

        active_jobs = active.count()
        companies = active.values('employer_profile').distinct().count()
        new_jobs_24h = active.filter(published__gte=now - timedelta(days=1)).count()

        # Growth: active jobs published per day over the last 7 days.
        growth = []
        for offset in range(6, -1, -1):
            day = (now - timedelta(days=offset)).date()
            day_start = timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, 0, 0, 0)
            ) if timezone.is_naive(now) else now.replace(
                year=day.year, month=day.month, day=day.day, hour=0, minute=0, second=0, microsecond=0
            )
            day_end = timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, 23, 59, 59)
            ) if timezone.is_naive(now) else now.replace(
                year=day.year, month=day.month, day=day.day, hour=23, minute=59, second=59, microsecond=0
            )
            growth.append({
                'date': day.strftime('%d/%m'),
                'count': active.filter(published__gte=day_start, published__lte=day_end).count(),
            })

        # Demand: active jobs per top-level category (rolled up from nghề/vị trí levels).
        demand = []
        for top in JobCategory.objects.filter(parent__isnull=True, status=JobCategory.Status.ACTIVE):
            children = JobCategory.objects.filter(parent=top).values_list('id', flat=True)
            grandchildren = JobCategory.objects.filter(parent_id__in=children).values_list('id', flat=True)
            ids = [top.id, *children, *grandchildren]
            count = active.filter(category_id__in=ids).count()
            if count:
                demand.append({
                    'id': top.id,
                    'name': top.name,
                    'slug': top.slug,
                    'logo_url': media_url_from_value(top.logo_url, request=request),
                    'count': count,
                })
        demand.sort(key=lambda d: d['count'], reverse=True)

        salary_demand = []
        for key, name, _gte, _lte in SALARY_BUCKETS:
            bucket = filter_salary_bucket(active, key)
            count = bucket.count()
            if count:
                salary_demand.append({'name': name, 'count': count})
        negotiable_count = active.filter(
            Q(is_salary_visible=False) | (Q(salary_min__isnull=True) & Q(salary_max__isnull=True))
        ).count()
        if negotiable_count:
            salary_demand.append({'name': 'Thỏa thuận', 'count': negotiable_count})

        latest = (
            active.select_related('employer_profile').prefetch_related('locations')
            .order_by('-published')[:10]
        )
        latest_jobs = [{
            'public_id': j.public_id,
            'slug': j.slug,
            'title': j.title,
            'company_name': j.employer_profile.company_name,
            'location_name': (j.locations.first().name if j.locations.exists() else ''),
            'location_names': [location.name for location in j.locations.all()],
            'work_type': j.work_type,
            'employment_type': j.employment_type,
            'experience_level': j.experience_level,
            'salary_min': j.salary_min,
            'salary_max': j.salary_max,
            'currency': j.currency,
            'is_salary_visible': j.is_salary_visible,
            'number_of_vacancies': j.number_of_vacancies,
            'deadline': j.deadline,
            'published_at': j.published,
            'short_description': j.short_description,
        } for j in latest]

        top_employers = list(
            active.values(
                'employer_profile_id',
                'employer_profile__public_id',
                'employer_profile__company_name',
                'employer_profile__slug',
                'employer_profile__company_logo_url',
            )
            .annotate(job_count=Count('id'))
            .order_by('-job_count', 'employer_profile__company_name')[:18]
        )
        # industries là M2M nên lấy riêng (join thẳng vào values() ở trên sẽ nhân đôi dòng
        # theo số lĩnh vực); gộp tên các lĩnh vực của mỗi công ty bằng dấu phẩy để hiển thị.
        industry_names = {
            row['id']: row['names']
            for row in EmployerProfile.objects.filter(id__in=[e['employer_profile_id'] for e in top_employers])
            .values('id')
            .annotate(names=StringAgg('industries__name', delimiter=', ', distinct=True))
        }

        featured_employers = [
            {
                'id': row['employer_profile_id'],
                'public_id': row['employer_profile__public_id'],
                'company_name': row['employer_profile__company_name'],
                'slug': row['employer_profile__slug'],
                'company_logo_url': media_url_from_value(
                    row['employer_profile__company_logo_url'], request=request,
                ),
                'industry': industry_names.get(row['employer_profile_id']) or '',
                'job_count': row['job_count'],
            }
            for row in top_employers
        ]

        return Response({
            'active_jobs': active_jobs,
            'companies': companies,
            'new_jobs_24h': new_jobs_24h,
            'growth': growth,
            'demand': demand[:24],
            'salary_demand': salary_demand[:6],
            'latest_jobs': latest_jobs,
            'featured_employers': featured_employers,
        })


class JobSuggestView(APIView):
    """Gợi ý từ khóa tìm kiếm dựa trên nội dung nhập (tên việc làm hoặc tên công ty)."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary='Gợi ý từ khóa tìm kiếm việc làm (autocomplete)',
        responses=inline_serializer('JobSuggest', fields={
            'suggestions': serializers.ListField(child=serializers.CharField()),
        }),
        tags=['jobs'],
    )
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({'suggestions': []})
        field = 'employer_profile__company_name' if request.query_params.get('search_by') == 'company' else 'title'
        values = (
            Job.objects.filter(status=Job.Status.ACTIVE)
            .filter(search_q(field, q))
            .values_list(field, flat=True)
            .distinct()
        )
        # Bỏ trùng + ưu tiên mục bắt đầu bằng từ khóa — đều so không dấu, không phân biệt hoa thường.
        ql = fold_accents(q)
        seen, starts, contains = set(), [], []
        for value in values:
            k = (value or '').strip()
            kf = fold_accents(k)
            if not k or kf in seen:
                continue
            seen.add(kf)
            (starts if kf.startswith(ql) else contains).append(k)
        return Response({'suggestions': (starts + contains)[:10]})


class JobDetailView(generics.RetrieveAPIView):
    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    queryset = Job.objects.filter(status=Job.Status.ACTIVE).prefetch_related('locations', 'job_skills')

    def get_object(self):
        job = super().get_object()
        Job.objects.filter(pk=job.pk).update(view_count=F('view_count') + 1)
        job.refresh_from_db(fields=['view_count'])
        return job


class SavedJobListCreateView(generics.ListCreateAPIView):
    """GET: toàn bộ tin đã lưu của ứng viên. POST {"job": "jb_xxx"}: lưu tin.

    Không phân trang: frontend cần trọn bộ id đã lưu để tô trạng thái trái tim
    trên mọi job card và đếm badge trên nút nổi.
    """

    serializer_class = SavedJobSerializer
    permission_classes = [IsCandidate]
    pagination_class = None

    def get_queryset(self):
        return (
            SavedJob.objects.filter(candidate=self.request.user)
            .select_related('job__employer_profile')
            .prefetch_related('job__locations', 'job__job_skills__skill')
        )

    def perform_create(self, serializer):
        serializer.save(candidate=self.request.user)


class SavedJobDestroyView(generics.DestroyAPIView):
    """DELETE /jobs/saved/<job_public_id>/ — bỏ lưu tin."""

    permission_classes = [IsCandidate]
    lookup_field = 'job__public_id'
    lookup_url_kwarg = 'public_id'

    def get_queryset(self):
        return SavedJob.objects.filter(candidate=self.request.user)


class EmployerJobListCreateView(generics.ListCreateAPIView):
    serializer_class = JobSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        return Job.objects.filter(employer=self.request.user).prefetch_related('locations').order_by('-created_at')

    def perform_create(self, serializer):
        try:
            employer_profile = self.request.user.employer_profile
        except EmployerProfile.DoesNotExist:
            raise ValidationError('Create your employer profile (company) before posting a job.')
        serializer.save(employer=self.request.user, employer_profile=employer_profile)


class EmployerJobDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = JobSerializer
    permission_classes = [IsEmployer]
    lookup_field = 'public_id'

    def get_queryset(self):
        return Job.objects.filter(employer=self.request.user).prefetch_related('locations', 'job_skills')
