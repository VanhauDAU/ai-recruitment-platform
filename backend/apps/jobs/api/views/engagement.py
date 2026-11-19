"""Consent-aware view and impression counters; job reads themselves never write."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiTypes, extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.privacy.services import load_consent
from common.metrics import record_metric

from ...selectors.listing import active_job_detail_queryset, active_job_tracking_queryset
from ...services.engagement import (
    record_consented_job_impressions,
    record_consented_job_view,
    set_viewer_cookie,
)


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
