import logging

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...selectors import employer_job_ai_generation_queryset
from ...services import (
    cancel_job_ai_generation,
    create_job_ai_generation,
    record_job_ai_feedback,
)
from ...tasks.ai_generation import generate_job_post
from ..serializers import (
    JobAiGenerationCreateResponseSerializer,
    JobAiGenerationCreateSerializer,
    JobAiGenerationErrorSerializer,
    JobAiGenerationFeedbackResponseSerializer,
    JobAiGenerationFeedbackSerializer,
    JobAiGenerationSerializer,
)

logger = logging.getLogger(__name__)


class EmployerJobAiGenerationCreateView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'ai_job_generation'

    @extend_schema(
        request=JobAiGenerationCreateSerializer,
        responses={
            202: JobAiGenerationCreateResponseSerializer,
            400: JobAiGenerationErrorSerializer,
            403: JobAiGenerationErrorSerializer,
            409: JobAiGenerationErrorSerializer,
            429: JobAiGenerationErrorSerializer,
            503: JobAiGenerationErrorSerializer,
        },
        tags=['Employer job AI'],
    )
    def post(self, request):
        serializer = JobAiGenerationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        generation, created, quota_remaining = create_job_ai_generation(
            user=request.user,
            validated_data=serializer.validated_data,
        )
        if created:
            try:
                generate_job_post.delay(generation.pk)
            except Exception:  # noqa: BLE001 - stale-queued recovery will redispatch safely
                logger.exception(
                    'Không thể dispatch job AI generation %s.',
                    generation.public_id,
                )
        return Response(
            {
                'public_id': generation.public_id,
                'status': generation.status,
                'phase': generation.phase,
                'quota_remaining': quota_remaining,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class EmployerJobAiGenerationDetailView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        responses={200: JobAiGenerationSerializer, 404: JobAiGenerationErrorSerializer},
        tags=['Employer job AI'],
    )
    def get(self, request, public_id):
        generation = get_object_or_404(
            employer_job_ai_generation_queryset(request.user),
            public_id=public_id,
        )
        return Response(JobAiGenerationSerializer(generation).data)


class EmployerJobAiGenerationCancelView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        request=None,
        responses={200: JobAiGenerationSerializer, 404: JobAiGenerationErrorSerializer},
        tags=['Employer job AI'],
    )
    def post(self, request, public_id):
        generation = get_object_or_404(
            employer_job_ai_generation_queryset(request.user),
            public_id=public_id,
        )
        generation = cancel_job_ai_generation(generation=generation, user=request.user)
        return Response(JobAiGenerationSerializer(generation).data)


class EmployerJobAiGenerationFeedbackView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        request=JobAiGenerationFeedbackSerializer,
        responses={
            200: JobAiGenerationFeedbackResponseSerializer,
            400: JobAiGenerationErrorSerializer,
            404: JobAiGenerationErrorSerializer,
        },
        tags=['Employer job AI'],
    )
    def post(self, request, public_id):
        generation = get_object_or_404(
            employer_job_ai_generation_queryset(request.user),
            public_id=public_id,
        )
        serializer = JobAiGenerationFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        generation = record_job_ai_feedback(
            generation=generation,
            user=request.user,
            value=serializer.validated_data['value'],
            reason=serializer.validated_data['reason'],
        )
        return Response(
            {
                'value': generation.feedback,
                'reason': generation.feedback_reason,
            }
        )
