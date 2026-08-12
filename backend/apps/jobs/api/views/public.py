from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiTypes, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate
from apps.cvs.models import UserCv
from apps.privacy.services import load_consent
from common.metrics import record_metric

from ...models import Job, SavedJob
from ...selectors.distribution import distribute_sponsored_job_page
from ...selectors.listing import (
    active_job_detail_queryset,
    active_job_tracking_queryset,
    build_job_list_queryset,
    publicly_available_job_filter,
    suggest_job_search_terms,
)
from ...selectors.presentation import prime_effective_service_presentations
from ...selectors.recommendations import (
    RecommendationConsentRequired,
    recommend_jobs_for_candidate,
    recommend_jobs_for_cv,
)
from ...selectors.stats import build_job_stats
from ...selectors.verification_badge import prime_badge_cache
from ...services.engagement import (
    record_consented_job_impressions,
    record_consented_job_view,
    set_viewer_cookie,
)
from ..serializers import (
    CandidateJobRecommendationResponseSerializer,
    CvJobRecommendationResponseSerializer,
    JobDetailSerializer,
    PublicJobListSerializer,
    PublicJobPreviewSerializer,
    RecommendationPermissionDeniedSerializer,
    SavedJobSerializer,
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

    def list(self, request, *args, **kwargs):
        explicit_ordering = bool(request.query_params.get('ordering'))
        if (
            not getattr(settings, 'SPONSORED_JOB_DISTRIBUTION_ENABLED', False)
            or not getattr(settings, 'JOB_PRESENTATION_V2_ENABLED', False)
            or explicit_ordering
        ):
            return super().list(request, *args, **kwargs)

        queryset = self.filter_queryset(self.get_queryset())
        paginator = self.paginator
        page_size = paginator.get_page_size(request) if paginator else 20
        try:
            page_number = int(request.query_params.get('page', 1))
        except (TypeError, ValueError):
            page_number = 1
        distributed = distribute_sponsored_job_page(
            queryset,
            page=page_number,
            page_size=page_size,
        )
        serializer = self.get_serializer(distributed.items, many=True)
        query = request.query_params.copy()

        def page_url(number):
            if number < 1 or number > distributed.total_pages:
                return None
            query['page'] = number
            return request.build_absolute_uri(f'{request.path}?{query.urlencode()}')

        return Response(
            {
                'count': distributed.total,
                'next': page_url(distributed.page + 1),
                'previous': page_url(distributed.page - 1),
                'results': serializer.data,
            }
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
        return Response(build_job_stats(request))


class JobSuggestView(APIView):
    """Gợi ý từ khóa tìm kiếm dựa trên nội dung nhập (tên việc làm hoặc tên công ty)."""

    permission_classes = [permissions.AllowAny]

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


def _serialize_recommendation_results(payload, request):
    # Context dùng chung cho cả trang: nạp cờ huy hiệu một lần thay vì để mỗi
    # tin tự truy vấn lại điều kiện xác thực của công ty.
    context = {'request': request}
    prime_badge_cache(
        context,
        {(item['job'].company_id, item['job'].posted_by_id) for item in payload['results']},
    )
    prime_effective_service_presentations(item['job'] for item in payload['results'])
    results = []
    for item in payload['results']:
        serialized = PublicJobListSerializer(item['job'], context=context).data
        serialized.update(
            {
                'match_score': item['match_score'],
                'match_details': item['match_details'],
                'match_reasons': item['match_reasons'],
                'is_high_match': item['match_score'] >= 70,
            }
        )
        results.append(serialized)
    return {**payload, 'results': results}


@extend_schema(
    summary='Gợi ý việc làm theo một CV của ứng viên',
    responses={
        200: CvJobRecommendationResponseSerializer,
        403: RecommendationPermissionDeniedSerializer,
    },
    tags=['jobs'],
)
class CvJobRecommendationView(APIView):
    """Candidate-only, explainable job ranking from one owner-scoped saved CV."""

    permission_classes = [IsCandidate]

    def get(self, request, cv_public_id):
        try:
            payload = recommend_jobs_for_cv(request.user, cv_public_id, limit=6)
        except UserCv.DoesNotExist as error:
            raise Http404 from error
        except RecommendationConsentRequired as error:
            raise PermissionDenied(
                'Bạn cần đồng ý nhận gợi ý việc làm trước khi hệ thống đọc dữ liệu CV.'
            ) from error
        return Response(_serialize_recommendation_results(payload, request))


class CandidateRecommendationQuerySerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=20, default=10)


@extend_schema(
    summary='Việc làm phù hợp với ứng viên hiện tại',
    parameters=[CandidateRecommendationQuerySerializer],
    responses={200: CandidateJobRecommendationResponseSerializer},
    tags=['jobs'],
)
class CandidateJobRecommendationView(APIView):
    """Explainable preference-first ranking for the candidate account page."""

    permission_classes = [IsCandidate]

    def get(self, request):
        query = CandidateRecommendationQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = recommend_jobs_for_candidate(
            request.user,
            page=query.validated_data['page'],
            page_size=query.validated_data['page_size'],
        )
        return Response(_serialize_recommendation_results(payload, request))


class JobDetailView(generics.RetrieveAPIView):
    serializer_class = JobDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        # Rebuild the availability predicate per request so deadline and
        # campaign status changes take effect without restarting the process.
        return active_job_detail_queryset()


@extend_schema(
    summary='Ghi nhận một lượt xem tin (có dedupe theo cookie)',
    request=None,
    responses={201: OpenApiTypes.OBJECT, 200: OpenApiTypes.OBJECT},
    tags=['jobs'],
)
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
            record_metric('job_engagement', event='view', reason='consent_required')
            return Response(
                {'counted': False, 'view_count': job.view_count, 'reason': 'consent_required'}
            )

        result = record_consented_job_view(request, job)
        viewer_id = result.pop('viewer_id', None)
        response = Response(result)
        set_viewer_cookie(response, viewer_id)
        return response


class JobImpressionBatchSerializer(serializers.Serializer):
    slugs = serializers.ListField(
        child=serializers.SlugField(max_length=255),
        min_length=1,
        max_length=50,
        allow_empty=False,
    )

    def validate_slugs(self, value):
        return list(dict.fromkeys(value))


@extend_schema(
    summary='Ghi nhận các lượt hiển thị job card hợp lệ',
    request=JobImpressionBatchSerializer,
    responses={200: OpenApiTypes.OBJECT},
    tags=['jobs'],
)
class JobImpressionBatchCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'job_impression'

    def post(self, request):
        serializer = JobImpressionBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slugs = serializer.validated_data['slugs']
        consent = load_consent(request)
        if not consent or not consent['analytics']:
            record_metric('job_impression_batch_size', len(slugs), reason='consent_required')
            record_metric('job_engagement', event='impression', reason='consent_required')
            return Response(
                {
                    'results': [
                        {'slug': slug, 'counted': False, 'reason': 'consent_required'}
                        for slug in slugs
                    ]
                }
            )

        jobs_by_slug = {job.slug: job for job in active_job_tracking_queryset(slugs)}
        jobs = [jobs_by_slug[slug] for slug in slugs if slug in jobs_by_slug]
        record_metric('job_impression_batch_size', len(slugs), reason='accepted')
        result = record_consented_job_impressions(request, jobs)
        tracked_by_slug = {item['slug']: item for item in result['results']}
        response = Response(
            {
                'results': [
                    tracked_by_slug.get(
                        slug,
                        {'slug': slug, 'counted': False, 'reason': 'not_found'},
                    )
                    for slug in slugs
                ]
            }
        )
        set_viewer_cookie(response, result.get('viewer_id'))
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
            SavedJob.objects.filter(
                candidate=self.request.user,
                job_id__in=Job.objects.filter(publicly_available_job_filter()).values('pk'),
            )
            .select_related('job__company')
            .prefetch_related(
                'job__category_assignments__category',
                'job__job_locations__location__parent',
                'job__job_skills__skill',
            )
        )

    def list(self, request, *args, **kwargs):
        saved_jobs = list(self.filter_queryset(self.get_queryset()))
        prime_effective_service_presentations(saved.job for saved in saved_jobs)
        return Response(self.get_serializer(saved_jobs, many=True).data)

    def perform_create(self, serializer):
        serializer.save(candidate=self.request.user)


@extend_schema(
    summary='Bỏ lưu tin tuyển dụng',
    responses={204: None},
    tags=['jobs'],
)
class SavedJobDestroyView(generics.DestroyAPIView):
    """DELETE /jobs/saved/<job_public_id>/ — bỏ lưu tin."""

    permission_classes = [IsCandidate]
    lookup_field = 'job__public_id'
    lookup_url_kwarg = 'public_id'

    def get_queryset(self):
        return SavedJob.objects.filter(candidate=self.request.user)
