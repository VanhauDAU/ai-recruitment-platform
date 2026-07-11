from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate, IsEmployer
from apps.employers.models import EmployerProfile

from .models import Job, JobCategory, SavedJob
from .querysets import build_job_list_queryset, fold_accents, search_q
from .serializers import JobCategorySerializer, JobSerializer, SavedJobSerializer
from .services import build_job_stats


class JobCategoryListView(generics.ListAPIView):
    serializer_class = JobCategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE)


class JobListView(generics.ListAPIView):
    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return build_job_list_queryset(self.request.query_params)


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
        return Response(build_job_stats(request))


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
