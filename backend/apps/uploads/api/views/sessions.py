import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.uploads.api.serializers import (
    UploadContentSerializer,
    UploadErrorSerializer,
    UploadSessionCreateSerializer,
    UploadSessionSerializer,
)
from apps.uploads.selectors import owned_upload_session
from apps.uploads.services import (
    UploadServiceError,
    cancel_upload_session,
    create_upload_session,
    request_scan_retry,
    store_quarantined_upload,
)
from apps.uploads.tasks import scan_upload_session

logger = logging.getLogger(__name__)

ERROR_STATUS = {
    'RESOURCE_NOT_FOUND': status.HTTP_404_NOT_FOUND,
    'UPLOAD_PURPOSE_FORBIDDEN': status.HTTP_403_FORBIDDEN,
    'UPLOAD_PIPELINE_DISABLED': status.HTTP_503_SERVICE_UNAVAILABLE,
    'UPLOAD_STORAGE_FAILED': status.HTTP_503_SERVICE_UNAVAILABLE,
    'UPLOAD_TOO_LARGE': status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    'UPLOAD_SESSION_QUOTA_EXCEEDED': status.HTTP_429_TOO_MANY_REQUESTS,
    'UPLOAD_BYTE_QUOTA_EXCEEDED': status.HTTP_429_TOO_MANY_REQUESTS,
    'UPLOAD_BUSY': status.HTTP_409_CONFLICT,
    'UPLOAD_EXPIRED': status.HTTP_409_CONFLICT,
    'UPLOAD_INVALID_STATE': status.HTTP_409_CONFLICT,
    'UPLOAD_NOT_CLEAN': status.HTTP_409_CONFLICT,
    'UPLOAD_SCAN_FAILED': status.HTTP_409_CONFLICT,
    'UPLOAD_ALREADY_SUBMITTED': status.HTTP_409_CONFLICT,
}


def _error_response(error):
    return Response(
        {
            'code': error.code,
            'message': error.message,
            'retryable': error.retryable,
        },
        status=ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
    )


def _missing_response():
    return Response(
        {
            'code': 'RESOURCE_NOT_FOUND',
            'message': 'Không tìm thấy upload session.',
            'retryable': False,
        },
        status=status.HTTP_404_NOT_FOUND,
    )


def _enqueue_scan(session_id):
    try:
        scan_upload_session.delay(session_id)
    except Exception:  # noqa: BLE001 - periodic reconciliation owns broker recovery
        logger.warning('Unable to enqueue owner upload scan.')


class UploadSessionCreateView(APIView):
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload_session'

    @extend_schema(
        summary='Tạo upload session tạm',
        request=UploadSessionCreateSerializer,
        responses={
            201: UploadSessionSerializer,
            400: UploadErrorSerializer,
            403: UploadErrorSerializer,
            413: UploadErrorSerializer,
            429: UploadErrorSerializer,
            503: UploadErrorSerializer,
        },
        tags=['uploads'],
    )
    def post(self, request):
        serializer = UploadSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = create_upload_session(
                owner=request.user,
                purpose=serializer.validated_data['purpose'],
                original_filename=serializer.validated_data['original_filename'],
                content_type=serializer.validated_data['content_type'],
                expected_size_bytes=serializer.validated_data['size_bytes'],
            )
        except UploadServiceError as error:
            return _error_response(error)
        return Response(UploadSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class UploadSessionDetailView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload_session'

    @extend_schema(
        summary='Xem trạng thái upload session của chính mình',
        responses={200: UploadSessionSerializer, 404: UploadErrorSerializer},
        tags=['uploads'],
    )
    def get(self, request, public_id):
        session = owned_upload_session(owner=request.user, public_id=public_id)
        if session is None:
            return _missing_response()
        return Response(UploadSessionSerializer(session).data)


class UploadSessionContentView(APIView):
    parser_classes = [MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload_content'

    @extend_schema(
        summary='Ghi nội dung tệp vào quarantine',
        request=UploadContentSerializer,
        responses={
            200: UploadSessionSerializer,
            400: UploadErrorSerializer,
            404: UploadErrorSerializer,
            409: UploadErrorSerializer,
            413: UploadErrorSerializer,
            503: UploadErrorSerializer,
        },
        tags=['uploads'],
    )
    def post(self, request, public_id):
        serializer = UploadContentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = store_quarantined_upload(
                owner=request.user,
                public_id=public_id,
                upload=serializer.validated_data['file'],
            )
        except UploadServiceError as error:
            return _error_response(error)
        _enqueue_scan(session.pk)
        refreshed = owned_upload_session(owner=request.user, public_id=public_id) or session
        return Response(UploadSessionSerializer(refreshed).data)


class UploadSessionCancelView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload_session'

    @extend_schema(
        summary='Hủy upload session và lên lịch dọn byte tạm',
        request=None,
        responses={
            200: UploadSessionSerializer,
            404: UploadErrorSerializer,
            409: UploadErrorSerializer,
        },
        tags=['uploads'],
    )
    def post(self, request, public_id):
        try:
            session = cancel_upload_session(owner=request.user, public_id=public_id)
        except UploadServiceError as error:
            return _error_response(error)
        return Response(UploadSessionSerializer(session).data)


class UploadSessionRetryView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload_session'

    @extend_schema(
        summary='Yêu cầu thử scan lại một session lỗi còn attempt budget',
        request=None,
        responses={
            200: UploadSessionSerializer,
            404: UploadErrorSerializer,
            409: UploadErrorSerializer,
        },
        tags=['uploads'],
    )
    def post(self, request, public_id):
        try:
            session = request_scan_retry(owner=request.user, public_id=public_id)
        except UploadServiceError as error:
            return _error_response(error)
        _enqueue_scan(session.pk)
        refreshed = owned_upload_session(owner=request.user, public_id=public_id) or session
        return Response(UploadSessionSerializer(refreshed).data)
