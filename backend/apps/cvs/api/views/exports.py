"""Owner-only PDF export jobs, always sourced from an immutable version, never a draft."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse, Http404
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cvs.api.serializers import CvExportCreateSerializer, CvExportSerializer
from apps.cvs.selectors import cv_exports_queryset
from apps.cvs.services import (
    CvExportPermissionError,
    CvExportStateError,
    CvExportUnavailableError,
    export_download_ready,
    owner_cv_export,
    request_cv_export,
    retry_cv_export,
)
from common.storage.r2 import private_media_storage

from .base import CandidateCvMixin, validation_detail


class CvExportListCreateView(CandidateCvMixin, APIView):
    """Owner-only PDF jobs sourced from immutable versions, never drafts."""

    @extend_schema(
        summary='Danh sách job export PDF',
        responses={200: CvExportSerializer(many=True)},
        tags=['cvs'],
    )
    def get(self, request, public_id):
        exports = cv_exports_queryset(self.get_cv())
        return Response(CvExportSerializer(exports, many=True, context={'request': request}).data)

    @extend_schema(
        summary='Tạo job export PDF từ version bất biến',
        request=CvExportCreateSerializer,
        responses={200: CvExportSerializer, 201: CvExportSerializer},
        tags=['cvs'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        serializer = CvExportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            export, reused = request_cv_export(
                cv=cv,
                actor=request.user,
                request=request,
                version_public_id=serializer.validated_data.get('version_public_id'),
            )
        except CvExportUnavailableError as error:
            raise Http404 from error
        except (CvExportPermissionError, DjangoValidationError) as error:
            raise ValidationError(validation_detail(error)) from error
        status_code = status.HTTP_200_OK if reused else status.HTTP_201_CREATED
        return Response(
            CvExportSerializer(export, context={'request': request}).data, status=status_code
        )


class CvExportDetailView(CandidateCvMixin, APIView):
    @extend_schema(
        summary='Trạng thái job export', responses={200: CvExportSerializer}, tags=['cvs']
    )
    def get(self, request, public_id, export_public_id):
        cv = self.get_cv()
        try:
            export = owner_cv_export(cv=cv, actor=request.user, export_public_id=export_public_id)
        except CvExportUnavailableError as error:
            raise Http404 from error
        return Response(CvExportSerializer(export, context={'request': request}).data)


class CvExportRetryView(CandidateCvMixin, APIView):
    @extend_schema(
        summary='Thử lại job export',
        request=None,
        responses={202: CvExportSerializer},
        tags=['cvs'],
    )
    def post(self, request, public_id, export_public_id):
        cv = self.get_cv()
        try:
            export = retry_cv_export(
                cv=cv,
                actor=request.user,
                request=request,
                export_public_id=export_public_id,
            )
        except CvExportUnavailableError as error:
            raise Http404 from error
        except (CvExportPermissionError, CvExportStateError) as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(
            CvExportSerializer(export, context={'request': request}).data,
            status=status.HTTP_202_ACCEPTED,
        )


class CvExportDownloadView(CandidateCvMixin, APIView):
    """Controlled owner download; no storage key or public media URL is exposed."""

    @extend_schema(
        summary='Tải PDF đã export',
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
        tags=['cvs'],
    )
    def get(self, request, public_id, export_public_id):
        cv = self.get_cv()
        try:
            export = owner_cv_export(cv=cv, actor=request.user, export_public_id=export_public_id)
        except CvExportUnavailableError as error:
            raise Http404 from error
        if not export_download_ready(export):
            raise Http404
        filename = f'{cv.title or "cv"}-v{export.version.version_number}.pdf'
        return FileResponse(
            private_media_storage().open(export.storage_key, 'rb'),
            as_attachment=True,
            filename=filename,
            content_type='application/pdf',
        )
