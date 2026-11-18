"""Importing a candidate's PDF/DOCX into the CV library."""

from django.conf import settings
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import parsers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate
from apps.cvs.api.exceptions import (
    CandidateCvRejectedResponse,
    CandidateUploadSessionRequiredResponse,
    CandidateUploadSessionResponse,
)
from apps.cvs.api.serializers import CvImportSerializer, CvSerializer
from apps.cvs.models import CvImportJob
from apps.cvs.services import (
    CvDocumentRejected,
    InvalidCvImport,
    UnsupportedCvUpload,
    import_uploaded_cv,
    import_uploaded_cv_from_session,
    queue_cv_import,
    queue_cv_import_from_session,
    retry_import,
    validate_import_upload,
)
from apps.uploads.services import UploadServiceError

from .base import CandidateCvMixin


class CvImportView(APIView):
    """Import a user-owned PDF/DOCX without exposing a storage URL."""

    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'cv_import'

    @extend_schema(
        summary='Import CV từ tệp PDF/DOCX',
        request=CvImportSerializer,
        responses={200: CvSerializer, 201: CvSerializer, 202: CvSerializer},
        tags=['cvs'],
    )
    def post(self, request):
        serializer = CvImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data.get('file')
        upload_session_public_id = serializer.validated_data.get('upload_session', '')
        # Errors point at whichever input the client actually sent.
        source_field = 'upload_session' if upload_session_public_id else 'file'
        if upload and settings.CANDIDATE_UPLOAD_SESSION_REQUIRED:
            raise CandidateUploadSessionRequiredResponse()
        if upload:
            try:
                validate_import_upload(upload)
            except InvalidCvImport as error:
                raise ValidationError({'file': str(error)}) from error
        title = serializer.validated_data.get('title', '')
        template = serializer.validated_data.get('template_public_id')
        if template is not None:
            # With a template the file is parsed asynchronously into an editable builder draft.
            queue_options = {
                'actor': request.user,
                'title': title,
                'template': template,
                'language': serializer.validated_data['language'],
                'theme_color': serializer.validated_data.get('theme_color'),
                'idempotency_key': request.headers.get('Idempotency-Key', ''),
            }
            try:
                if upload_session_public_id:
                    cv, _job, created = queue_cv_import_from_session(
                        upload_session_public_id=upload_session_public_id, **queue_options
                    )
                else:
                    cv, _job, created = queue_cv_import(upload=upload, **queue_options)
            except UploadServiceError as error:
                raise CandidateUploadSessionResponse(error) from error
            except InvalidCvImport as error:
                raise ValidationError({source_field: str(error)}) from error
            return Response(
                CvSerializer(cv).data,
                status=status.HTTP_202_ACCEPTED if created else status.HTTP_200_OK,
            )
        try:
            if upload_session_public_id:
                cv = import_uploaded_cv_from_session(
                    actor=request.user,
                    upload_session_public_id=upload_session_public_id,
                    title=title,
                )
            else:
                cv = import_uploaded_cv(actor=request.user, upload=upload, title=title)
        except UploadServiceError as error:
            raise CandidateUploadSessionResponse(error) from error
        except CvDocumentRejected as error:
            raise CandidateCvRejectedResponse(error) from error
        except (UnsupportedCvUpload, InvalidCvImport) as error:
            raise ValidationError({source_field: str(error)}) from error
        return Response(CvSerializer(cv).data, status=status.HTTP_201_CREATED)


class CvImportRetryView(CandidateCvMixin, APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'cv_import'

    @extend_schema(
        summary='Thử lại job import CV',
        request=None,
        responses={202: CvSerializer},
        tags=['cvs'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        try:
            retry_import(cv=cv, actor=request.user)
        except CvImportJob.DoesNotExist as error:
            raise Http404 from error
        except InvalidCvImport as error:
            raise ValidationError({'detail': str(error)}) from error
        cv.refresh_from_db()
        return Response(CvSerializer(cv).data, status=status.HTTP_202_ACCEPTED)
