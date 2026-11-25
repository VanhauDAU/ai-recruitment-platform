"""Owner-scoped upload sessions; ``UploadServiceError`` maps to its HTTP status centrally."""

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
    cancel_upload_session,
    create_upload_session,
    enqueue_upload_scan,
    request_scan_retry,
    store_quarantined_upload,
    upload_error,
)
from common.api.throttling import with_account_write_cap


class UploadSessionCreateView(APIView):
    parser_classes = [JSONParser]
    throttle_classes = with_account_write_cap(ScopedRateThrottle)
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
        session = create_upload_session(
            owner=request.user,
            purpose=serializer.validated_data['purpose'],
            original_filename=serializer.validated_data['original_filename'],
            content_type=serializer.validated_data['content_type'],
            expected_size_bytes=serializer.validated_data['size_bytes'],
        )
        return Response(UploadSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class UploadSessionDetailView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload_status'

    @extend_schema(
        summary='Xem trạng thái upload session của chính mình',
        responses={200: UploadSessionSerializer, 404: UploadErrorSerializer},
        tags=['uploads'],
    )
    def get(self, request, public_id):
        session = owned_upload_session(owner=request.user, public_id=public_id)
        if session is None:
            raise upload_error('RESOURCE_NOT_FOUND')
        return Response(UploadSessionSerializer(session).data)


class UploadSessionContentView(APIView):
    parser_classes = [MultiPartParser]
    throttle_classes = with_account_write_cap(ScopedRateThrottle)
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
        session = store_quarantined_upload(
            owner=request.user,
            public_id=public_id,
            upload=serializer.validated_data['file'],
        )
        enqueue_upload_scan(session.pk)
        refreshed = owned_upload_session(owner=request.user, public_id=public_id) or session
        return Response(UploadSessionSerializer(refreshed).data)


class UploadSessionCancelView(APIView):
    throttle_classes = with_account_write_cap(ScopedRateThrottle)
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
        session = cancel_upload_session(owner=request.user, public_id=public_id)
        return Response(UploadSessionSerializer(session).data)


class UploadSessionRetryView(APIView):
    throttle_classes = with_account_write_cap(ScopedRateThrottle)
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
        session = request_scan_retry(owner=request.user, public_id=public_id)
        enqueue_upload_scan(session.pk)
        refreshed = owned_upload_session(owner=request.user, public_id=public_id) or session
        return Response(UploadSessionSerializer(refreshed).data)
