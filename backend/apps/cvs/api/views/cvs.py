"""Candidate CV library: list/create, metadata, duplicate, delete and owner reads."""

from django.http import FileResponse, Http404
from drf_spectacular.utils import (
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate
from apps.cv_templates.services import PositionContentUnavailable
from apps.cvs.api.serializers import (
    CvCreateSerializer,
    CvDuplicateSerializer,
    CvMetadataUpdateSerializer,
    CvSerializer,
)
from apps.cvs.models import CvVersion
from apps.cvs.selectors import candidate_cvs_queryset
from apps.cvs.services import (
    CvCreateInProgress,
    CvLifecyclePolicyError,
    CvShareUnavailableError,
    create_user_cv_once,
    current_thumbnail_ready,
    duplicate_cv,
    owner_view_version,
    permanently_delete_cv,
    request_current_cv_thumbnail,
    update_cv_metadata,
)
from common.storage.r2 import private_media_storage

from .base import (
    CandidateCvMixin,
    read_only_cv_payload,
    read_only_cv_schema,
    uploaded_cv_pdf_response,
)


@extend_schema_view(
    get=extend_schema(summary='Danh sách CV của ứng viên'),
    post=extend_schema(
        summary='Tạo CV mới (Idempotency-Key tùy chọn)',
        request=CvCreateSerializer,
        responses={200: CvSerializer, 201: CvSerializer, 409: OpenApiTypes.OBJECT},
    ),
)
@extend_schema(tags=['cvs'])
class CvListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return candidate_cvs_queryset(self.request.user)

    def get_serializer_class(self):
        return CvCreateSerializer if self.request.method == 'POST' else CvSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cv, replayed = create_user_cv_once(
                actor=request.user,
                idempotency_key=request.headers.get('Idempotency-Key', ''),
                title=serializer.validated_data['title'],
                template=serializer.validated_data['template_public_id'],
                language=serializer.validated_data['language'],
                position=serializer.validated_data.get('position_public_id'),
                experience_band=serializer.validated_data['experience_band'],
                source_cv=serializer.validated_data.get('source_cv_public_id'),
                theme_color=serializer.validated_data.get('theme_color'),
            )
        except PositionContentUnavailable as error:
            raise ValidationError({'position_public_id': str(error)}) from error
        except CvLifecyclePolicyError as error:
            raise PermissionDenied(str(error)) from error
        except CvCreateInProgress as error:
            return Response({'detail': str(error)}, status=status.HTTP_409_CONFLICT)
        return Response(
            CvSerializer(cv).data,
            status=status.HTTP_200_OK if replayed else status.HTTP_201_CREATED,
        )


class CvDetailView(CandidateCvMixin, APIView):
    @extend_schema(summary='Chi tiết CV', responses={200: CvSerializer}, tags=['cvs'])
    def get(self, request, public_id):
        return Response(CvSerializer(self.get_cv(), context={'request': request}).data)

    @extend_schema(
        summary='Cập nhật metadata CV',
        request=CvMetadataUpdateSerializer,
        responses={200: CvSerializer},
        tags=['cvs'],
    )
    def patch(self, request, public_id):
        cv = self.get_cv()
        serializer = CvMetadataUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_cv = update_cv_metadata(cv=cv, actor=request.user, **serializer.validated_data)
        return Response(CvSerializer(updated_cv).data)

    @extend_schema(summary='Xóa vĩnh viễn CV', responses={204: None}, tags=['cvs'])
    def delete(self, request, public_id):
        try:
            permanently_delete_cv(cv=self.get_cv(), actor=request.user)
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class CvDuplicateView(CandidateCvMixin, APIView):
    @extend_schema(
        summary='Nhân bản CV',
        request=CvDuplicateSerializer,
        responses={201: CvSerializer},
        tags=['cvs'],
    )
    def post(self, request, public_id):
        serializer = CvDuplicateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            duplicate = duplicate_cv(
                cv=self.get_cv(),
                actor=request.user,
                title=serializer.validated_data.get('title', ''),
            )
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvSerializer(duplicate).data, status=status.HTTP_201_CREATED)


class CvOwnerVersionView(CandidateCvMixin, APIView):
    """Candidate-only read view deliberately sourced from an immutable version."""

    @extend_schema(
        summary='Chủ sở hữu xem CV từ bản version bất biến',
        responses={200: read_only_cv_schema('OwnerCvVersionView', 'OwnerCvSummary')},
        tags=['cvs'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        try:
            version = owner_view_version(cv=cv, actor=request.user, request=request)
        except CvShareUnavailableError as error:
            raise Http404 from error
        return Response(read_only_cv_payload(cv, version, request))


class CvSourceFileView(CandidateCvMixin, APIView):
    """Owner-only inline PDF of an uploaded CV's original file."""

    @extend_schema(
        summary='Xem tệp gốc của CV tải lên (PDF)',
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
        tags=['cvs'],
    )
    def get(self, request, public_id):
        return uploaded_cv_pdf_response(self.get_cv())


class CvThumbnailView(CandidateCvMixin, APIView):
    """Owner-only first-page image; the private storage key is never serialized."""

    @extend_schema(
        summary='Ảnh preview trang đầu (WebP)',
        responses={(200, 'image/webp'): OpenApiTypes.BINARY},
        tags=['cvs'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        if not current_thumbnail_ready(cv):
            raise Http404
        return FileResponse(
            private_media_storage().open(cv.thumbnail_url, 'rb'),
            filename=f'{cv.title or "cv"}-preview.webp',
            content_type='image/webp',
        )

    @extend_schema(
        summary='Yêu cầu tạo lại ảnh preview',
        request=None,
        responses={
            200: inline_serializer(
                'CvThumbnailStatus',
                {
                    'status': serializers.CharField(),
                    'thumbnail_url': serializers.CharField(allow_null=True),
                },
            )
        },
        tags=['cvs'],
    )
    def post(self, request, public_id):
        try:
            cv = request_current_cv_thumbnail(cv=self.get_cv(), actor=request.user)
        except (ValueError, CvVersion.DoesNotExist) as error:
            raise Http404 from error
        ready = current_thumbnail_ready(cv)
        payload = CvSerializer(cv, context={'request': request}).data
        return Response(
            {'status': 'ready' if ready else 'pending', 'thumbnail_url': payload['thumbnail_url']},
            status=status.HTTP_200_OK if ready else status.HTTP_202_ACCEPTED,
        )
