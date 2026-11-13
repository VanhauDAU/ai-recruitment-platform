from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from ...selectors import candidate_job_alerts
from ...services import JOB_ALERT_LIMIT, create_job_alert, delete_job_alert, update_job_alert
from ..serializers import (
    JobAlertCreateSerializer,
    JobAlertListResponseSerializer,
    JobAlertReadSerializer,
    JobAlertWriteSerializer,
)

JOB_ALERT_BAD_REQUEST_RESPONSE = OpenApiResponse(
    response=OpenApiTypes.OBJECT,
    description=(
        'Lỗi validation theo field, hoặc lỗi nghiệp vụ có `code` ổn định: '
        '`duplicate_alert`, `alert_limit_reached`, `email_unverified`.'
    ),
)


class CandidateJobAlertListCreateView(APIView):
    permission_classes = [IsCandidate]

    @extend_schema(
        operation_id='candidate_job_alert_list',
        responses={200: JobAlertListResponseSerializer},
        tags=['jobs'],
    )
    def get(self, request):
        alerts = list(candidate_job_alerts(request.user))
        return Response(
            {
                'results': JobAlertReadSerializer(alerts, many=True).data,
                'limit': JOB_ALERT_LIMIT,
                'remaining': max(JOB_ALERT_LIMIT - len(alerts), 0),
            }
        )

    @extend_schema(
        operation_id='candidate_job_alert_create',
        request=JobAlertCreateSerializer,
        responses={201: JobAlertReadSerializer, 400: JOB_ALERT_BAD_REQUEST_RESPONSE},
        tags=['jobs'],
    )
    def post(self, request):
        serializer = JobAlertCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alert = create_job_alert(request.user, serializer.validated_data)
        alert = candidate_job_alerts(request.user).get(pk=alert.pk)
        return Response(JobAlertReadSerializer(alert).data, status=status.HTTP_201_CREATED)


class CandidateJobAlertDetailView(APIView):
    permission_classes = [IsCandidate]

    def get_object(self, request, public_id):
        return get_object_or_404(candidate_job_alerts(request.user), public_id=public_id)

    @extend_schema(
        operation_id='candidate_job_alert_retrieve',
        responses={200: JobAlertReadSerializer},
        tags=['jobs'],
    )
    def get(self, request, public_id):
        return Response(JobAlertReadSerializer(self.get_object(request, public_id)).data)

    @extend_schema(
        operation_id='candidate_job_alert_update',
        request=JobAlertWriteSerializer,
        responses={200: JobAlertReadSerializer, 400: JOB_ALERT_BAD_REQUEST_RESPONSE},
        tags=['jobs'],
    )
    def patch(self, request, public_id):
        alert = self.get_object(request, public_id)
        serializer = JobAlertWriteSerializer(alert, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        alert = update_job_alert(request.user, alert, serializer.validated_data)
        alert = candidate_job_alerts(request.user).get(pk=alert.pk)
        return Response(JobAlertReadSerializer(alert).data)

    @extend_schema(
        operation_id='candidate_job_alert_delete',
        responses={204: None},
        tags=['jobs'],
    )
    def delete(self, request, public_id):
        alert = self.get_object(request, public_id)
        delete_job_alert(request.user, alert)
        return Response(status=status.HTTP_204_NO_CONTENT)
