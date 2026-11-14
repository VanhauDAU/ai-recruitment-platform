"""Recruiter PDF export of an application's immutable CV snapshot."""

from django.http import FileResponse, Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.cvs.services import (
    CvExportPermissionError,
    CvExportUnavailableError,
    application_snapshot_export,
    export_download_ready,
    request_application_snapshot_export,
)
from apps.employers.services import ensure_recruiter_candidate_data_access
from common.r2_storage import private_media_storage

from ...models import Application
from ...selectors import recruiter_application_snapshot_queryset
from ...services import record_application_cv_download
from ..serializers.v2 import RecruiterCvExportSerializer


def _snapshot_application(request, public_id):
    try:
        application = recruiter_application_snapshot_queryset(request.user).get(public_id=public_id)
    except Application.DoesNotExist as error:
        raise Http404 from error
    ensure_recruiter_candidate_data_access(request.user)
    return application


def _snapshot_export(application, export_public_id):
    try:
        return application_snapshot_export(
            version=application.submitted_cv_version, export_public_id=export_public_id
        )
    except CvExportUnavailableError as error:
        raise Http404 from error


def _payload(request, application, export):
    return RecruiterCvExportSerializer(
        export,
        context={
            'request': request,
            'application_public_id': application.public_id,
            'download_ready': export_download_ready(export),
        },
    ).data


@extend_schema(
    tags=['applications-v2'],
    summary='NTD yêu cầu PDF của CV đã nộp (tạo mới hoặc dùng lại bản đã render)',
    request=None,
    responses={200: RecruiterCvExportSerializer, 201: RecruiterCvExportSerializer},
)
class RecruiterApplicationCvExportView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id):
        application = _snapshot_application(request, public_id)
        try:
            export, reused = request_application_snapshot_export(
                version=application.submitted_cv_version, actor=request.user
            )
        except CvExportPermissionError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(
            _payload(request, application, export),
            status=status.HTTP_200_OK if reused else status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=['applications-v2'],
    summary='Trạng thái PDF của CV đã nộp',
    responses={200: RecruiterCvExportSerializer},
)
class RecruiterApplicationCvExportDetailView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id, export_public_id):
        application = _snapshot_application(request, public_id)
        return Response(
            _payload(request, application, _snapshot_export(application, export_public_id))
        )


@extend_schema(
    tags=['applications-v2'],
    summary='Tải PDF CV đã nộp; ứng viên được báo một lần cho mỗi hồ sơ',
    responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
)
class RecruiterApplicationCvExportDownloadView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id, export_public_id):
        application = _snapshot_application(request, public_id)
        export = _snapshot_export(application, export_public_id)
        if not export_download_ready(export):
            raise Http404
        handle = private_media_storage().open(export.storage_key, 'rb')
        record_application_cv_download(application, actor=request.user, request=request)
        name = application.contact_name or application.submitted_cv_title or 'ung-vien'
        return FileResponse(
            handle,
            as_attachment=True,
            filename=f'CV - {name} - {application.job.title}.pdf',
            content_type='application/pdf',
        )
