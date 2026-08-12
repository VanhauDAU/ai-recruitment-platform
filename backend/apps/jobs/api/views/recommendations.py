"""Candidate-facing recommendation HTTP endpoints."""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from ...selectors import recommend_jobs_from_saved
from ...selectors.presentation import prime_effective_service_presentations
from ...selectors.verification_badge import prime_badge_cache
from ..serializers import (
    PublicJobListSerializer,
    SavedJobRecommendationResponseSerializer,
)


class SavedJobRecommendationQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=20, default=12)


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
