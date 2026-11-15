import csv

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access

from ...selectors import (
    employer_application_queryset,
    employer_applications_queryset,
    recruiter_application_history_queryset,
)
from ...services import (
    InvalidApplicationStatusTransition,
    change_application_status,
    undo_latest_status_change,
    undoable_status_history,
    update_application_assessment,
)
from ..serializers.employer import (
    ApplicationAssessmentSerializer,
    ApplicationDecisionResultSerializer,
    ApplicationSerializer,
    ApplicationStatusDecisionSerializer,
)
from ..serializers.history import ApplicationStatusHistorySerializer


def _csv_cell(value):
    """Prevent spreadsheet formula execution when the exported CSV is opened."""
    text = str(value or '')
    return f"'{text}" if text.startswith(('=', '+', '-', '@')) else text


class EmployerApplicationListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsEmployer]

    def get_queryset(self):
        ensure_recruiter_candidate_data_access(self.request.user)
        return employer_applications_queryset(
            self.request.user,
            self.request.query_params.get('job'),
            status=self.request.query_params.get('status'),
            campaign=self.request.query_params.get('campaign'),
            q=self.request.query_params.get('q'),
            scope=self.request.query_params.get('scope'),
            ordering=self.request.query_params.get('ordering'),
        )


class EmployerApplicationExportView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        ensure_recruiter_candidate_data_access(request.user)
        queryset = employer_applications_queryset(
            request.user,
            request.query_params.get('job'),
            status=request.query_params.get('status'),
            campaign=request.query_params.get('campaign'),
            q=request.query_params.get('q'),
            scope=request.query_params.get('scope'),
            ordering=request.query_params.get('ordering'),
        )
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="campaign-applications.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(
            [
                'Ứng viên',
                'Email',
                'Tin tuyển dụng',
                'CV đã nộp',
                'Trạng thái',
                'Ngày ứng tuyển',
            ]
        )
        for application in queryset.iterator(chunk_size=200):
            writer.writerow(
                [
                    _csv_cell(application.candidate.full_name or application.candidate.email),
                    _csv_cell(application.candidate.email),
                    _csv_cell(application.job.title),
                    _csv_cell(application.submitted_cv_title),
                    _csv_cell(application.get_status_display()),
                    application.applied_at.isoformat(),
                ]
            )
        return response


def _recruiter_application(request, public_id):
    ensure_recruiter_candidate_data_access(request.user)
    return get_object_or_404(employer_application_queryset(request.user), public_id=public_id)


def _workspace_row(request, application):
    return ApplicationSerializer(
        employer_applications_queryset(request.user).get(pk=application.pk)
    ).data


@extend_schema(
    tags=['applications-v2'],
    summary='NTD cập nhật ghi chú và đánh giá nội bộ (không đổi trạng thái)',
    request=ApplicationAssessmentSerializer,
    responses={200: ApplicationSerializer},
)
class EmployerApplicationAssessmentView(APIView):
    permission_classes = [IsEmployer]

    def patch(self, request, public_id):
        application = _recruiter_application(request, public_id)
        serializer = ApplicationAssessmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_application_assessment(
            application, changed_by=request.user, **serializer.validated_data
        )
        return Response(_workspace_row(request, application))


@extend_schema(
    tags=['applications-v2'],
    summary='NTD ra quyết định cho hồ sơ; ứng viên được báo sau thời gian chờ hoàn tác',
    request=ApplicationStatusDecisionSerializer,
    responses={200: ApplicationDecisionResultSerializer},
)
class EmployerApplicationDecisionView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        application = _recruiter_application(request, public_id)
        serializer = ApplicationStatusDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            application, notice = change_application_status(
                application,
                changed_by=request.user,
                status=serializer.validated_data['status'],
            )
        except InvalidApplicationStatusTransition as error:
            raise ValidationError({'status': str(error)}) from error
        return Response(
            {
                'application': _workspace_row(request, application),
                'candidate_notice_at': notice.deliver_after,
            }
        )


@extend_schema(
    tags=['applications-v2'],
    summary='NTD hoàn tác quyết định gần nhất khi ứng viên chưa nhận thông báo',
    request=None,
    responses={
        200: ApplicationSerializer,
        409: OpenApiResponse(description='STATUS_UNDO_UNAVAILABLE'),
    },
)
class EmployerApplicationDecisionUndoView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        application = _recruiter_application(request, public_id)
        application = undo_latest_status_change(application, changed_by=request.user)
        return Response(_workspace_row(request, application))


class EmployerApplicationHistoryView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = ApplicationStatusHistorySerializer

    def get_queryset(self):
        self.application = _recruiter_application(self.request, self.kwargs['public_id'])
        return recruiter_application_history_queryset(self.application)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        application = getattr(self, 'application', None)
        if application is not None:
            undoable = undoable_status_history(application, user=self.request.user)
            context['undoable_history_id'] = undoable.pk if undoable else None
        return context
