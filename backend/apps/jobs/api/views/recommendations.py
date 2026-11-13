"""Candidate-facing recommendation HTTP endpoints."""

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate
from apps.privacy.services import load_consent
from apps.services.services import record_saved_job_remarketing_impression

from ...models import Job
from ...selectors import (
    recommend_inline_jobs_for_candidate,
    recommend_jobs_from_saved,
    saved_job_remarketing_lane,
)
from ...selectors.presentation import prime_effective_service_presentations
from ...selectors.verification_badge import prime_badge_cache
from ...services import hide_recommended_job, restore_recommended_job
from ..serializers import (
    HiddenJobCreateSerializer,
    HiddenJobResponseSerializer,
    InlineJobRecommendationQuerySerializer,
    InlineJobRecommendationResponseSerializer,
    PublicJobListSerializer,
    SavedJobRecommendationResponseSerializer,
)


class SavedJobRecommendationQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=20, default=12)


def _serialize_public_jobs(rows, request):
    jobs = [row['job'] for row in rows]
    context = {'request': request}
    prime_badge_cache(
        context,
        {(job.company_id, job.posted_by_id) for job in jobs},
    )
    prime_effective_service_presentations(jobs)
    return PublicJobListSerializer(jobs, many=True, context=context).data


@extend_schema(
    summary='Tin gợi ý chèn ngẫu nhiên trong danh sách việc làm',
    parameters=[InlineJobRecommendationQuerySerializer],
    responses={200: InlineJobRecommendationResponseSerializer},
    tags=['jobs'],
)
class InlineJobRecommendationView(APIView):
    permission_classes = [IsCandidate]

    def get(self, request):
        query = InlineJobRecommendationQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = recommend_inline_jobs_for_candidate(
            request.user,
            page=query.validated_data['page'],
            ranking_seed=query.validated_data['ranking_seed'],
            excluded_public_ids=query.validated_data['excluded_public_ids'],
        )
        return Response(
            {
                **payload,
                'results': _serialize_public_jobs(payload['results'], request),
            }
        )


@extend_schema(
    request=HiddenJobCreateSerializer,
    responses={200: HiddenJobResponseSerializer},
    summary='Ẩn một tin khỏi các bề mặt gợi ý cá nhân',
    tags=['jobs'],
)
class HiddenJobCreateView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request):
        serializer = HiddenJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            hide_recommended_job(candidate=request.user, **serializer.validated_data)
        except Job.DoesNotExist as error:
            raise Http404 from error
        return Response(
            {
                'hidden': True,
                'job_public_id': serializer.validated_data['job_public_id'],
            }
        )


@extend_schema(
    request=None,
    responses={200: HiddenJobResponseSerializer},
    summary='Hoàn tác ẩn một tin trên phạm vi ứng viên hiện tại',
    tags=['jobs'],
)
class HiddenJobDestroyView(APIView):
    permission_classes = [IsCandidate]

    def delete(self, request, job_public_id):
        restore_recommended_job(
            candidate=request.user,
            job_public_id=job_public_id,
        )
        return Response({'hidden': False, 'job_public_id': job_public_id})


def _serialize_results(payload, request):
    # Xem chú thích ở `public._serialize_recommendation_results`.
    context = {'request': request}
    prime_badge_cache(
        context,
        {(item['job'].company_id, item['job'].posted_by_id) for item in payload['results']},
    )
    prime_effective_service_presentations(item['job'] for item in payload['results'])
    results = []
    for item in payload['results']:
        job = PublicJobListSerializer(item['job'], context=context).data
        job.update(
            {
                'similarity_score': item['similarity_score'],
                'similarity_reasons': item['similarity_reasons'],
                'similarity_details': item['similarity_details'],
            }
        )
        results.append(job)
    return {**payload, 'results': results}


@extend_schema(
    summary='Việc làm tương tự các tin ứng viên đã lưu',
    parameters=[SavedJobRecommendationQuerySerializer],
    responses={200: SavedJobRecommendationResponseSerializer},
    tags=['jobs'],
)
class SavedJobRecommendationView(APIView):
    permission_classes = [IsCandidate]

    def get(self, request):
        query = SavedJobRecommendationQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        payload = recommend_jobs_from_saved(
            request.user,
            limit=query.validated_data['limit'],
        )
        return Response(_serialize_results(payload, request))


class SavedJobRemarketingImpressionSerializer(serializers.Serializer):
    job_public_id = serializers.CharField(max_length=50)
    activation_public_id = serializers.CharField(max_length=50)


def _marketing_consent_granted(request):
    consent = load_consent(request)
    return bool(consent and consent.get('marketing'))


@extend_schema(summary='Lane tin đã lưu được remarketing có kiểm soát', tags=['jobs'])
class SavedJobRemarketingLaneView(APIView):
    permission_classes = [IsCandidate]

    def get(self, request):
        if not getattr(settings, 'SAVED_JOB_REMARKETING_ENABLED', False):
            return Response({'status': 'disabled', 'results': []})
        if not _marketing_consent_granted(request):
            return Response({'status': 'consent_required', 'results': []})
        rows = saved_job_remarketing_lane(request.user)
        context = {'request': request}
        prime_badge_cache(
            context,
            {(row['job'].company_id, row['job'].posted_by_id) for row in rows},
        )
        prime_effective_service_presentations(row['job'] for row in rows)
        results = []
        for row in rows:
            job = PublicJobListSerializer(row['job'], context=context).data
            presentation = dict(job.get('presentation') or {})
            labels = list(presentation.get('labels') or [])
            if not any(label.get('code') == 'sponsored' for label in labels):
                labels.insert(
                    0,
                    {'code': 'sponsored', 'text': 'Tài trợ', 'tone': 'sponsored'},
                )
            presentation.update(
                {
                    'sponsored': True,
                    'labels': labels,
                    'display_reason': row['display_reason'],
                    'placement': 'saved_remarketing',
                }
            )
            job['presentation'] = presentation
            job.update(
                {
                    'remarketing_activation_public_id': row['activation_public_id'],
                    'display_reason': row['display_reason'],
                }
            )
            results.append(job)
        return Response({'status': 'ready', 'results': results})


@extend_schema(
    request=SavedJobRemarketingImpressionSerializer,
    summary='Ghi nhận một lượt hiển thị remarketing tin đã lưu',
    tags=['jobs'],
)
class SavedJobRemarketingImpressionView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request):
        if not getattr(settings, 'SAVED_JOB_REMARKETING_ENABLED', False):
            return Response({'counted': False, 'reason': 'disabled'})
        if not _marketing_consent_granted(request):
            return Response({'counted': False, 'reason': 'consent_required'}, status=403)
        serializer = SavedJobRemarketingImpressionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            _, created = record_saved_job_remarketing_impression(
                candidate=request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as error:
            detail = getattr(error, 'messages', None) or [str(error)]
            return Response({'counted': False, 'detail': detail}, status=409)
        return Response({'counted': created})
