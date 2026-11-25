import csv

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access
from apps.matching.selectors import application_match_detail

from ...selectors import (
    employer_application_queryset,
    employer_applications_queryset,
    previous_submissions_queryset,
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
    PreviousSubmissionSerializer,
)
from ..serializers.history import ApplicationStatusHistorySerializer


def _csv_cell(value):
    """Prevent spreadsheet formula execution when the exported CSV is opened."""
    text = str(value or '')
    return f"'{text}" if text.startswith(('=', '+', '-', '@')) else text


@extend_schema(tags=['applications'], summary='Hồ sơ ứng tuyển vào các tin của NTD')
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


@extend_schema(
    tags=['applications'],
    summary='Xuất danh sách hồ sơ ứng tuyển ra CSV',
    responses={(200, 'text/csv'): OpenApiTypes.BINARY},
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
                _('Ứng viên'),
                'Email',
                _('Tin tuyển dụng'),
                _('CV đã nộp'),
                _('Trạng thái'),
                _('Ngày ứng tuyển'),
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
    tags=['applications'],
    summary='Mức phù hợp do AI chấm cho một hồ sơ (chi tiết từng tiêu chí)',
    description=(
        '`status`: `ready` (có `result`), `pending` (đang phân tích), `failed`, '
        '`not_consented` (ứng viên không tham gia phân tích AI), hoặc null khi tính năng tắt. '
        'Kết quả chấm trên bản CV đã nộp; không có gợi ý sửa CV dành cho ứng viên.'
    ),
    responses={200: OpenApiTypes.OBJECT},
)
class EmployerApplicationAiMatchView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        return Response(application_match_detail(_recruiter_application(request, public_id)))


@extend_schema(
    tags=['applications'],
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
    tags=['applications'],
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
    tags=['applications'],
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


@extend_schema(tags=['applications'], summary='Các lần nộp trước của ứng viên vào cùng tin')
class EmployerApplicationSubmissionsView(generics.ListAPIView):
    """Earlier submissions of the same candidate to the same job, read-only."""

    permission_classes = [IsEmployer]
    serializer_class = PreviousSubmissionSerializer
    pagination_class = None

    def get_queryset(self):
        return previous_submissions_queryset(
            _recruiter_application(self.request, self.kwargs['public_id'])
        )


@extend_schema(tags=['applications'], summary='Lịch sử trạng thái của hồ sơ')
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
