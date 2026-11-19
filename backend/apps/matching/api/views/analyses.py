from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate

from ...models import MatchAnalysis
from ...selectors import (
    owner_analysis,
    owner_cv_for_matching,
    public_job_for_profile,
    recent_owner_analyses,
)
from ...services import MatchingRequestError, ensure_enabled, request_analysis
from ..serializers import AnalysisErrorSerializer, AnalysisRequestSerializer, AnalysisSerializer


class AnalysisListCreateView(APIView):
    """POST: yêu cầu phân tích một CV với một tin. GET ?job=<slug>: các lần gần nhất."""

    permission_classes = [IsCandidate]
    throttle_scope = 'match_analysis'

    def get_throttles(self):
        # Chỉ giới hạn lượt yêu cầu phân tích; xem lại kết quả không tốn lượt.
        return [ScopedRateThrottle()] if self.request.method == 'POST' else []

    @extend_schema(
        parameters=[OpenApiParameter('job', str, required=True)],
        responses={200: AnalysisSerializer(many=True), 403: AnalysisErrorSerializer},
        tags=['Matching'],
    )
    def get(self, request):
        ensure_enabled()
        job = public_job_for_profile(request.query_params.get('job', ''))
        if job is None:
            raise MatchingRequestError('job_not_active')
        analyses = recent_owner_analyses(request.user, job)
        return Response(AnalysisSerializer(analyses, many=True).data)

    @extend_schema(
        request=AnalysisRequestSerializer,
        responses={
            200: AnalysisSerializer,
            202: AnalysisSerializer,
            403: AnalysisErrorSerializer,
            404: AnalysisErrorSerializer,
            422: AnalysisErrorSerializer,
            429: AnalysisErrorSerializer,
        },
        tags=['Matching'],
    )
    def post(self, request):
        serializer = AnalysisRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ensure_enabled()
        job = public_job_for_profile(serializer.validated_data['job'])
        if job is None:
            raise MatchingRequestError('job_not_active')
        cv = owner_cv_for_matching(request.user, serializer.validated_data['cv'])
        if cv is None:
            raise MatchingRequestError('cv_not_owned')
        analysis = request_analysis(user=request.user, job=job, cv=cv)
        done = analysis.status == MatchAnalysis.Status.SUCCEEDED
        data = AnalysisSerializer(analysis, context={'cached': done}).data
        return Response(data, status=status.HTTP_200_OK if done else status.HTTP_202_ACCEPTED)


class AnalysisDetailView(APIView):
    permission_classes = [IsCandidate]

    @extend_schema(
        responses={200: AnalysisSerializer, 404: AnalysisErrorSerializer}, tags=['Matching']
    )
    def get(self, request, public_id):
        analysis = owner_analysis(request.user, public_id)
        if analysis is None:
            raise NotFound({'code': 'analysis_not_found', 'detail': 'Không tìm thấy kết quả.'})
        return Response(AnalysisSerializer(analysis).data)
