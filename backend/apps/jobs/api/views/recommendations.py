"""Candidate-facing recommendation HTTP endpoints."""

from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate
from apps.cvs.models import UserCv

from ...models import Job
from ...selectors import recommend_inline_jobs_for_candidate, recommend_jobs_from_saved
from ...selectors.recommendations import (
    RecommendationConsentRequired,
    recommend_jobs_for_candidate,
    recommend_jobs_for_cv,
)
from ...selectors.verification_badge import prime_badge_cache
from ...services import hide_recommended_job, restore_recommended_job
from ..serializers import (
    CandidateJobRecommendationResponseSerializer,
    CvJobRecommendationResponseSerializer,
    HiddenJobCreateSerializer,
    HiddenJobResponseSerializer,
    InlineJobRecommendationQuerySerializer,
    InlineJobRecommendationResponseSerializer,
    PublicJobListSerializer,
    RecommendationPermissionDeniedSerializer,
    SavedJobRecommendationResponseSerializer,
)


class SavedJobRecommendationQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=20, default=12)


def _job_cards(rows, request, *, extra_fields=()):
    """Public job cards for ranked rows, each carrying the row's ``extra_fields``.

    The badge flags are loaded once for the whole page; otherwise every card
    queries its company's verification state again.
    """
    context = {'request': request}
    prime_badge_cache(
        context,
        {(row['job'].company_id, row['job'].posted_by_id) for row in rows},
    )
    cards = []
    for row in rows:
        card = PublicJobListSerializer(row['job'], context=context).data
        card.update({field: row[field] for field in extra_fields})
        cards.append(card)
    return cards


def _ranked_payload(payload, request, *, extra_fields):
    return {
        **payload,
        'results': _job_cards(payload['results'], request, extra_fields=extra_fields),
    }


MATCH_FIELDS = ('match_score', 'match_details', 'match_reasons')
SIMILARITY_FIELDS = ('similarity_score', 'similarity_reasons', 'similarity_details')


def _match_payload(payload, request):
    result = _ranked_payload(payload, request, extra_fields=MATCH_FIELDS)
    for card in result['results']:
        card['is_high_match'] = card['match_score'] >= 70
    return result


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
                'results': _job_cards(payload['results'], request),
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
        return Response(_ranked_payload(payload, request, extra_fields=SIMILARITY_FIELDS))


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
        return Response(_match_payload(payload, request))


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
        return Response(_match_payload(payload, request))
