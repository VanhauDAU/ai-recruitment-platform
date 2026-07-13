from django.conf import settings
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate
from apps.privacy.services import load_consent
from ...models import Job, SavedJob
from ...selectors.listing import (
    active_job_detail_queryset,
    build_job_list_queryset,
    suggest_job_search_terms,
)
from ...selectors.stats import build_job_stats
from ...services.engagement import record_consented_job_view, set_viewer_cookie
from ..serializers import (
    JobDetailSerializer,
    PublicJobListSerializer,
    PublicJobPreviewSerializer,
    SavedJobSerializer,
)


class JobListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        return PublicJobPreviewSerializer if self.request.query_params.get('view') == 'preview' else PublicJobListSerializer

    def get_queryset(self):
        return build_job_list_queryset(
            self.request.query_params,
            include_preview=self.request.query_params.get('view') == 'preview',
        )


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
                    'company_logo_url': serializers.CharField(allow_blank=True),
                    'location_name': serializers.CharField(),
                    'location_names': serializers.ListField(child=serializers.CharField()),
                    'work_type': serializers.CharField(allow_blank=True),
                    'employment_type': serializers.CharField(allow_blank=True),
                    'experience_years': serializers.CharField(allow_blank=True),
                    'salary_min': serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True),
                    'salary_max': serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True),
                    'currency': serializers.CharField(),
                    'salary_type': serializers.CharField(),
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
        return Response({'suggestions': suggest_job_search_terms(
            request.query_params.get('q'), request.query_params.get('search_by')
        )})


class JobDetailView(generics.RetrieveAPIView):
    serializer_class = JobDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    queryset = active_job_detail_queryset()



class JobViewCreateView(APIView):
    """Explicit, consent-aware engagement endpoint. GET detail remains read-only."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'job_view'

    @extend_schema(
        summary='Ghi nhận lượt xem việc làm khi đã đồng ý Analytics',
        responses=inline_serializer(
            'JobViewResult',
            fields={
                'counted': serializers.BooleanField(),
                'view_count': serializers.IntegerField(),
                'reason': serializers.CharField(required=False),
            },
        ),
        tags=['jobs'],
    )
    def post(self, request, slug):
        job = get_object_or_404(active_job_detail_queryset(), slug=slug)
        consent = load_consent(request)
        if not consent or not consent['analytics']:
            return Response({'counted': False, 'view_count': job.view_count, 'reason': 'consent_required'})

        result = record_consented_job_view(request, job)
        viewer_id = result.pop('viewer_id', None)
        response = Response(result)
        set_viewer_cookie(response, viewer_id)
        return response


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
            .select_related('job__company')
            .prefetch_related(
                'job__category_assignments__category',
                'job__job_locations__location__parent',
                'job__job_skills__skill',
                'job__job_benefits__benefit',
            )
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
