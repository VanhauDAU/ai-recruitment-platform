"""Anonymous job discovery: search, the home-page boxes, market stats and detail."""

import re

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.api.caching import cache_public_get
from common.api.throttling import ClientIPScopedRateThrottle

from ...selectors.homepage import (
    DEFAULT_BEST_JOBS_ROTATION_SEED,
    build_homepage_best_jobs_queryset,
    homepage_best_job_locations,
)
from ...selectors.listing import (
    build_job_list_queryset,
    job_detail_queryset,
    suggest_job_search_terms,
)
from ...selectors.stats import build_job_stats
from ..serializers import JobDetailSerializer, PublicJobListSerializer, PublicJobPreviewSerializer

# The dashboard payload is cached server-side for five minutes; browsers and
# shared caches may keep a response for one.
JOB_STATS_CACHE_CONTROL = 'public, max-age=60'


@extend_schema(
    tags=['jobs'],
    summary='Danh sách việc làm công khai (lọc, tìm kiếm, sắp xếp)',
    parameters=[OpenApiParameter('view', str, enum=['preview'])],
)
class JobListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        return (
            PublicJobPreviewSerializer
            if self.request.query_params.get('view') == 'preview'
            else PublicJobListSerializer
        )

    def get_queryset(self):
        return build_job_list_queryset(
            self.request.query_params,
            include_preview=self.request.query_params.get('view') == 'preview',
        )


@extend_schema(
    tags=['jobs'],
    summary='Việc làm tốt nhất trên trang chủ (kèm rotation_seed)',
    parameters=[OpenApiParameter('rotation_seed', str)],
)
class HomepageBestJobListView(generics.ListAPIView):
    """Independently rotated jobs admitted to the homepage Best Jobs box."""

    permission_classes = [permissions.AllowAny]
    serializer_class = PublicJobPreviewSerializer
    ROTATION_SEED_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,64}$')

    def _snapshot_at(self):
        if not hasattr(self, '_homepage_best_jobs_snapshot_at'):
            self._homepage_best_jobs_snapshot_at = timezone.now()
        return self._homepage_best_jobs_snapshot_at

    def _rotation_seed(self):
        rotation_seed = self.request.query_params.get(
            'rotation_seed', DEFAULT_BEST_JOBS_ROTATION_SEED
        )
        if not self.ROTATION_SEED_PATTERN.fullmatch(rotation_seed):
            raise ValidationError({'rotation_seed': 'Invalid rotation seed.'})
        return rotation_seed

    def get_queryset(self):
        return build_homepage_best_jobs_queryset(
            self.request.query_params,
            at=self._snapshot_at(),
            rotation_seed=self._rotation_seed(),
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data['rotation_seed'] = self._rotation_seed()
        return response


_LOCATION_FACET_FIELDS = {
    'id': serializers.IntegerField(),
    'name': serializers.CharField(),
    'job_count': serializers.IntegerField(),
}


@cache_public_get()
class HomepageBestJobLocationsView(APIView):
    """Locations that currently have public jobs, for the Best Jobs filter chips."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=['jobs'],
        summary='Tỉnh và phường/xã đang có việc làm (bộ lọc Việc làm nổi bật)',
        responses=inline_serializer(
            'HomepageBestJobLocations',
            fields={
                'provinces': inline_serializer(
                    'HomepageBestJobProvince', many=True, fields=_LOCATION_FACET_FIELDS
                ),
                'wards': inline_serializer(
                    'HomepageBestJobWard',
                    many=True,
                    fields={
                        **_LOCATION_FACET_FIELDS,
                        'parent_id': serializers.IntegerField(allow_null=True),
                        'parent_name': serializers.CharField(),
                    },
                ),
            },
        ),
    )
    def get(self, request):
        return Response(homepage_best_job_locations())


class JobStatsView(APIView):
    """Aggregate stats for the homepage market dashboard (public)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'job_stats'

    @extend_schema(
        summary='Thống kê thị trường việc làm (dashboard trang chủ)',
        responses=inline_serializer(
            'JobStats',
            fields={
                'candidates': serializers.IntegerField(),
                'employers': serializers.IntegerField(),
                'active_jobs': serializers.IntegerField(),
                'companies': serializers.IntegerField(),
                'new_jobs_24h': serializers.IntegerField(),
                'growth': inline_serializer(
                    'JobStatsGrowth',
                    many=True,
                    fields={
                        'date': serializers.CharField(),
                        'count': serializers.IntegerField(),
                    },
                ),
                'demand': inline_serializer(
                    'JobStatsDemand',
                    many=True,
                    fields={
                        'id': serializers.IntegerField(),
                        'name': serializers.CharField(),
                        'slug': serializers.CharField(),
                        'logo_url': serializers.CharField(allow_blank=True),
                        'count': serializers.IntegerField(),
                    },
                ),
                'salary_demand': inline_serializer(
                    'JobStatsSalaryDemand',
                    many=True,
                    fields={
                        'name': serializers.CharField(),
                        'count': serializers.IntegerField(),
                    },
                ),
                'latest_jobs': inline_serializer(
                    'JobStatsLatest',
                    many=True,
                    fields={
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
                        'salary_min': serializers.DecimalField(
                            max_digits=14, decimal_places=2, allow_null=True
                        ),
                        'salary_max': serializers.DecimalField(
                            max_digits=14, decimal_places=2, allow_null=True
                        ),
                        'currency': serializers.CharField(),
                        'salary_type': serializers.CharField(),
                        'number_of_vacancies': serializers.IntegerField(allow_null=True),
                        'deadline': serializers.DateField(allow_null=True),
                        'published_at': serializers.DateTimeField(allow_null=True),
                        'short_description': serializers.CharField(allow_blank=True),
                    },
                ),
                'featured_employers': inline_serializer(
                    'JobStatsFeaturedEmployer',
                    many=True,
                    fields={
                        'id': serializers.IntegerField(),
                        'public_id': serializers.CharField(),
                        'company_name': serializers.CharField(),
                        'slug': serializers.CharField(),
                        'company_logo_url': serializers.CharField(allow_blank=True),
                        'industry': serializers.CharField(allow_blank=True),
                        'job_count': serializers.IntegerField(),
                    },
                ),
            },
        ),
        tags=['jobs'],
    )
    def get(self, request):
        return Response(
            build_job_stats(request), headers={'Cache-Control': JOB_STATS_CACHE_CONTROL}
        )


class JobSuggestView(APIView):
    """Gợi ý từ khóa tìm kiếm dựa trên nội dung nhập (tên việc làm hoặc tên công ty)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'job_suggest'

    @extend_schema(
        summary='Gợi ý từ khóa tìm kiếm việc làm (autocomplete)',
        responses=inline_serializer(
            'JobSuggest',
            fields={
                'suggestions': serializers.ListField(child=serializers.CharField()),
            },
        ),
        tags=['jobs'],
    )
    def get(self, request):
        return Response(
            {
                'suggestions': suggest_job_search_terms(
                    request.query_params.get('q'), request.query_params.get('search_by')
                )
            }
        )


@extend_schema(tags=['jobs'], summary='Chi tiết việc làm theo slug')
class JobDetailView(generics.RetrieveAPIView):
    serializer_class = JobDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        # Rebuild the availability predicate per request so deadline and
        # campaign status changes take effect without restarting the process.
        # Stopped jobs stay readable (application history links to them) but
        # say they no longer take applications.
        return job_detail_queryset()
