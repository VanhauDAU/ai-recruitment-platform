"""HTTP endpoints for the candidate-owned CV lifecycle V2 API."""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse, Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate
from apps.cv_templates.models import CvTemplate
from apps.cv_templates.services import PositionContentUnavailable
from common.metrics import record_metric
from common.r2_storage import cv_asset_storage, private_media_storage

from ...models import CvAsset, CvDraft, CvExport, CvImportJob, CvSharedLink, CvVersion, UserCv
from ...selectors import (
    candidate_cv_by_public_id,
    candidate_cv_versions_queryset,
    candidate_cvs_queryset,
    latest_recoverable_cv,
)
from ...services import (
    CvExportPermissionError,
    CvExportStateError,
    CvExportUnavailableError,
    CvLifecyclePolicyError,
    CvSharePermissionError,
    CvShareUnavailableError,
    InvalidCvImport,
    StaleDraftError,
    UnsupportedCvUpload,
    apply_sample_to_draft,
    create_avatar_asset,
    create_shared_link,
    create_v2_cv,
    duplicate_cv,
    export_download_ready,
    import_v2_cv,
    owner_cv_export,
    owner_view_version,
    permanently_delete_cv,
    queue_cv_import,
    request_current_cv_thumbnail,
    request_cv_export,
    resolve_shared_link,
    retry_cv_export,
    retry_import,
    revoke_shared_link,
    save_draft_as_version,
    switch_draft_template,
    update_cv_metadata,
    update_draft,
)
from ...services.assets import resolve_asset_token
from ...services.composition import CvCompositionError, compose_cv_document
from ..serializers.v2 import (
    CvApplySampleSerializer,
    CvAssetSerializer,
    CvAssetUploadSerializer,
    CvDraftSerializer,
    CvDraftWriteSerializer,
    CvExportCreateSerializer,
    CvExportSerializer,
    CvSharedLinkCreateSerializer,
    CvSharedLinkSerializer,
    CvTemplateSwitchSerializer,
    CvV2CreateSerializer,
    CvV2DuplicateSerializer,
    CvV2ImportSerializer,
    CvV2MetadataUpdateSerializer,
    CvV2Serializer,
    CvVersionSerializer,
    CvVersionSummarySerializer,
    SharedCvVersionSerializer,
)

LOCK_HEADER_RE = re.compile(r'^"?lock-version-(\d+)"?$')


def expected_lock_version(request):
    value = request.headers.get('If-Match', '')
    match = LOCK_HEADER_RE.fullmatch(value.strip())
    if match is None:
        raise ValidationError({'If-Match': 'Use If-Match: "lock-version-<number>".'})
    return int(match.group(1))


def draft_conflict_response(cv):
    record_metric('cv_autosave_conflict')
    current_lock = CvDraft.objects.filter(cv=cv).values_list('lock_version', flat=True).first()
    return Response(
        {
            'detail': 'Draft has changed in another session.',
            'current_lock_version': current_lock,
        },
        status=status.HTTP_409_CONFLICT,
    )


class CandidateV2CvMixin:
    permission_classes = [IsCandidate]

    def get_cv(self):
        try:
            return candidate_cv_by_public_id(self.request.user, self.kwargs['public_id'])
        except self.model.DoesNotExist as error:
            raise Http404 from error


class CvV2ListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCandidate]

    def get_queryset(self):
        return candidate_cvs_queryset(self.request.user).select_related(
            'current_template_version',
            'latest_version',
            'published_version',
        )

    def get_serializer_class(self):
        return CvV2CreateSerializer if self.request.method == 'POST' else CvV2Serializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cv = create_v2_cv(
                actor=request.user,
                title=serializer.validated_data['title'],
                template=serializer.validated_data['template_public_id'],
                language=serializer.validated_data['language'],
                sample_content=serializer.validated_data.get('sample_content_public_id'),
                position=serializer.validated_data.get('position_public_id'),
                source_cv=serializer.validated_data.get('source_cv_public_id'),
                theme_color=serializer.validated_data.get('theme_color'),
            )
        except PositionContentUnavailable as error:
            raise ValidationError({'position_public_id': str(error)}) from error
        except CvLifecyclePolicyError as error:
            raise PermissionDenied(str(error)) from error
        return Response(CvV2Serializer(cv).data, status=status.HTTP_201_CREATED)


class CvV2LatestRecoverableDraftView(APIView):
    permission_classes = [IsCandidate]

    @extend_schema(
        summary='Bản nháp CV gần nhất còn khôi phục được',
        responses={
            200: inline_serializer(
                'LatestRecoverableDraft',
                {
                    'cv': CvV2Serializer(),
                    'draft': CvDraftSerializer(),
                },
            ),
            204: None,
        },
        tags=['cvs-v2'],
    )
    def get(self, request):
        cv = latest_recoverable_cv(request.user)
        if cv is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        draft = cv.draft
        return Response(
            {
                'cv': CvV2Serializer(cv).data,
                'draft': CvDraftSerializer(draft).data,
            },
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )


class CvV2DetailView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(summary='Chi tiết CV', responses={200: CvV2Serializer}, tags=['cvs-v2'])
    def get(self, request, public_id):
        return Response(CvV2Serializer(self.get_cv(), context={'request': request}).data)

    @extend_schema(
        summary='Cập nhật metadata CV',
        request=CvV2MetadataUpdateSerializer,
        responses={200: CvV2Serializer},
        tags=['cvs-v2'],
    )
    def patch(self, request, public_id):
        cv = self.get_cv()
        serializer = CvV2MetadataUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_cv = update_cv_metadata(cv=cv, actor=request.user, **serializer.validated_data)
        return Response(CvV2Serializer(updated_cv).data)

    @extend_schema(summary='Xóa vĩnh viễn CV', responses={204: None}, tags=['cvs-v2'])
    def delete(self, request, public_id):
        try:
            permanently_delete_cv(cv=self.get_cv(), actor=request.user)
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class CvV2DuplicateView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(
        summary='Nhân bản CV',
        request=CvV2DuplicateSerializer,
        responses={201: CvV2Serializer},
        tags=['cvs-v2'],
    )
    def post(self, request, public_id):
        serializer = CvV2DuplicateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            duplicate = duplicate_cv(
                cv=self.get_cv(),
                actor=request.user,
                title=serializer.validated_data.get('title', ''),
            )
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvV2Serializer(duplicate).data, status=status.HTTP_201_CREATED)


class CvV2ImportView(APIView):
    """Import a user-owned PDF/DOCX without exposing a storage URL."""

    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'cv_import'

    @extend_schema(
        summary='Import CV từ tệp PDF/DOCX',
        request=CvV2ImportSerializer,
        responses={200: CvV2Serializer, 201: CvV2Serializer, 202: CvV2Serializer},
        tags=['cvs-v2'],
    )
    def post(self, request):
        serializer = CvV2ImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = serializer.validated_data.get('template_public_id')
        if template is not None:
            try:
                cv, _job, created = queue_cv_import(
                    actor=request.user,
                    upload=serializer.validated_data['file'],
                    title=serializer.validated_data.get('title', ''),
                    template=template,
                    language=serializer.validated_data['language'],
                    theme_color=serializer.validated_data.get('theme_color'),
                    idempotency_key=request.headers.get('Idempotency-Key', ''),
                )
            except InvalidCvImport as error:
                raise ValidationError({'file': str(error)}) from error
            return Response(
                CvV2Serializer(cv).data,
                status=status.HTTP_202_ACCEPTED if created else status.HTTP_200_OK,
            )
        try:
            cv = import_v2_cv(
                actor=request.user,
                upload=serializer.validated_data['file'],
                title=serializer.validated_data.get('title', ''),
            )
        except UnsupportedCvUpload as error:
            raise ValidationError({'file': str(error)}) from error
        return Response(CvV2Serializer(cv).data, status=status.HTTP_201_CREATED)


class CvV2ImportRetryView(CandidateV2CvMixin, APIView):
    model = UserCv
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'cv_import'

    @extend_schema(
        summary='Thử lại job import CV',
        request=None,
        responses={202: CvV2Serializer},
        tags=['cvs-v2'],
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
        return Response(CvV2Serializer(cv).data, status=status.HTTP_202_ACCEPTED)


def read_only_cv_payload(cv, version, request=None):
    return {
        'cv': {
            'public_id': cv.public_id,
            'title': cv.title,
            'language': cv.language,
            'is_default': cv.is_default,
        },
        'version': SharedCvVersionSerializer(version, context={'request': request}).data,
    }


class CvV2OwnerVersionView(CandidateV2CvMixin, APIView):
    """Candidate-only read view deliberately sourced from an immutable version."""

    model = UserCv

    @extend_schema(
        summary='Chủ sở hữu xem CV từ bản version bất biến',
        responses={
            200: inline_serializer(
                'OwnerCvVersionView',
                {
                    'cv': inline_serializer(
                        'OwnerCvSummary',
                        {
                            'public_id': serializers.CharField(),
                            'title': serializers.CharField(),
                            'language': serializers.CharField(),
                            'is_default': serializers.BooleanField(),
                        },
                    ),
                    'version': SharedCvVersionSerializer(),
                },
            )
        },
        tags=['cvs-v2'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        try:
            version = owner_view_version(cv=cv, actor=request.user, request=request)
        except CvShareUnavailableError as error:
            raise Http404 from error
        return Response(read_only_cv_payload(cv, version, request))


class CvV2SharedLinkListCreateView(CandidateV2CvMixin, APIView):
    """Owner-scoped shared-link management; raw token is returned exactly once."""

    model = UserCv

    @extend_schema(
        summary='Danh sách link chia sẻ của CV',
        responses={200: CvSharedLinkSerializer(many=True)},
        tags=['cvs-v2'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        links = CvSharedLink.objects.filter(cv=cv).select_related('version').order_by('-created_at')
        return Response(CvSharedLinkSerializer(links, many=True).data)

    @extend_schema(
        summary='Tạo link chia sẻ (token trả về đúng một lần)',
        request=CvSharedLinkCreateSerializer,
        responses={
            201: inline_serializer(
                'CvSharedLinkCreated',
                {
                    'link': CvSharedLinkSerializer(),
                    'token': serializers.CharField(),
                },
            )
        },
        tags=['cvs-v2'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        serializer = CvSharedLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link, raw_token = create_shared_link(
                cv=cv,
                actor=request.user,
                version_public_id=serializer.validated_data.get('version_public_id'),
                expires_at=serializer.validated_data.get('expires_at'),
            )
        except CvSharePermissionError as error:
            raise PermissionDenied(str(error)) from error
        return Response(
            {'link': CvSharedLinkSerializer(link).data, 'token': raw_token},
            status=status.HTTP_201_CREATED,
        )


class CvV2SharedLinkRevokeView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(summary='Thu hồi link chia sẻ', responses={204: None}, tags=['cvs-v2'])
    def delete(self, request, public_id, link_public_id):
        cv = self.get_cv()
        try:
            revoke_shared_link(
                cv=cv,
                actor=request.user,
                link_public_id=link_public_id,
            )
        except CvShareUnavailableError as error:
            raise Http404 from error
        except CvSharePermissionError as error:
            raise PermissionDenied(str(error)) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class CvV2SharedLinkPublicView(APIView):
    """Unauthenticated bearer endpoint. Invalid/revoked/expired links are indistinguishable."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        summary='Xem CV qua link chia sẻ (không cần đăng nhập)',
        responses={
            200: inline_serializer(
                'SharedCvView',
                {
                    'cv': inline_serializer(
                        'SharedCvSummary',
                        {
                            'public_id': serializers.CharField(),
                            'title': serializers.CharField(),
                            'language': serializers.CharField(),
                            'is_default': serializers.BooleanField(),
                        },
                    ),
                    'version': SharedCvVersionSerializer(),
                },
            )
        },
        tags=['cvs-v2'],
    )
    def get(self, request, token):
        try:
            link, version = resolve_shared_link(raw_token=token, request=request)
        except CvShareUnavailableError as error:
            raise Http404 from error
        return Response(read_only_cv_payload(link.cv, version, request))


class CvV2ExportListCreateView(CandidateV2CvMixin, APIView):
    """Owner-only PDF jobs sourced from immutable versions, never drafts."""

    model = UserCv

    @extend_schema(
        summary='Danh sách job export PDF',
        responses={200: CvExportSerializer(many=True)},
        tags=['cvs-v2'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        exports = (
            CvExport.objects.filter(cv=cv).select_related('cv', 'version').order_by('-created_at')
        )
        return Response(CvExportSerializer(exports, many=True, context={'request': request}).data)

    @extend_schema(
        summary='Tạo job export PDF từ version bất biến',
        request=CvExportCreateSerializer,
        responses={200: CvExportSerializer, 201: CvExportSerializer},
        tags=['cvs-v2'],
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
            detail = (
                error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            )
            raise ValidationError(detail) from error
        status_code = status.HTTP_200_OK if reused else status.HTTP_201_CREATED
        return Response(
            CvExportSerializer(export, context={'request': request}).data, status=status_code
        )


class CvV2ExportDetailView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(
        summary='Trạng thái job export', responses={200: CvExportSerializer}, tags=['cvs-v2']
    )
    def get(self, request, public_id, export_public_id):
        cv = self.get_cv()
        try:
            export = owner_cv_export(cv=cv, actor=request.user, export_public_id=export_public_id)
        except CvExportUnavailableError as error:
            raise Http404 from error
        return Response(CvExportSerializer(export, context={'request': request}).data)


class CvV2ExportRetryView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(
        summary='Thử lại job export',
        request=None,
        responses={202: CvExportSerializer},
        tags=['cvs-v2'],
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


class CvV2ExportDownloadView(CandidateV2CvMixin, APIView):
    """Controlled owner download; no storage key or public media URL is exposed."""

    model = UserCv

    @extend_schema(
        summary='Tải PDF đã export',
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
        tags=['cvs-v2'],
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


class CvV2ThumbnailView(CandidateV2CvMixin, APIView):
    """Owner-only first-page image; the private storage key is never serialized."""

    model = UserCv

    @extend_schema(
        summary='Ảnh preview trang đầu (WebP)',
        responses={(200, 'image/webp'): OpenApiTypes.BINARY},
        tags=['cvs-v2'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        from ...services import current_thumbnail_ready

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
        tags=['cvs-v2'],
    )
    def post(self, request, public_id):
        try:
            cv = request_current_cv_thumbnail(cv=self.get_cv(), actor=request.user)
        except (ValueError, CvVersion.DoesNotExist) as error:
            raise Http404 from error
        from ...services import current_thumbnail_ready

        ready = current_thumbnail_ready(cv)
        payload = CvV2Serializer(cv, context={'request': request}).data
        return Response(
            {'status': 'ready' if ready else 'pending', 'thumbnail_url': payload['thumbnail_url']},
            status=status.HTTP_200_OK if ready else status.HTTP_202_ACCEPTED,
        )


class CvV2DraftView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(
        summary='Đọc bản nháp đang soạn', responses={200: CvDraftSerializer}, tags=['cvs-v2']
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        try:
            draft = CvDraft.objects.select_related('base_version').get(cv=cv)
        except CvDraft.DoesNotExist as error:
            raise Http404 from error
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )

    @extend_schema(
        summary='Lưu bản nháp (autosave, cần header If-Match: "lock-version-N")',
        request=CvDraftWriteSerializer,
        responses={200: CvDraftSerializer, 409: OpenApiTypes.OBJECT},
        tags=['cvs-v2'],
    )
    def put(self, request, public_id):
        cv = self.get_cv()
        serializer = CvDraftWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            draft = update_draft(
                cv=cv,
                actor=request.user,
                content_json=serializer.validated_data['content_json'],
                layout_json=serializer.validated_data['layout_json'],
                style_json=serializer.validated_data['style_json'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except DjangoValidationError as error:
            detail = error.message_dict if hasattr(error, 'message_dict') else error.messages
            raise ValidationError(detail) from error
        except CvLifecyclePolicyError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )


class CvV2TemplateSwitchView(CandidateV2CvMixin, APIView):
    """Switch presentation contract while keeping the canonical content immutable."""

    model = UserCv

    @extend_schema(
        summary='Đổi mẫu CV, giữ nguyên nội dung canonical',
        request=CvTemplateSwitchSerializer,
        responses={
            200: inline_serializer(
                'CvTemplateSwitched',
                {
                    'cv': CvV2Serializer(),
                    'draft': CvDraftSerializer(),
                },
            ),
            409: OpenApiTypes.OBJECT,
        },
        tags=['cvs-v2'],
    )
    def put(self, request, public_id):
        cv = self.get_cv()
        serializer = CvTemplateSwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            switched_cv, draft = switch_draft_template(
                cv=cv,
                actor=request.user,
                template_public_id=serializer.validated_data['template_public_id'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
                theme_color=serializer.validated_data.get('theme_color'),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except (CvLifecyclePolicyError, DjangoValidationError) as error:
            detail = (
                error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            )
            raise ValidationError(detail) from error
        return Response(
            {
                'cv': CvV2Serializer(switched_cv).data,
                'draft': CvDraftSerializer(draft, context={'request': request}).data,
            },
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )


class CvV2TemplatePreviewView(CandidateV2CvMixin, APIView):
    """Project one owned draft onto a template without mutating either aggregate."""

    model = UserCv

    @extend_schema(
        summary='Xem trước bản nháp trên một mẫu khác (không ghi dữ liệu)',
        parameters=[
            OpenApiParameter('template_public_id', str, required=True),
            OpenApiParameter('theme_color', str, description='Hex 6 ký tự, ví dụ #1A73E8'),
        ],
        responses={200: OpenApiTypes.OBJECT},
        tags=['cvs-v2'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        template_public_id = request.query_params.get('template_public_id', '').strip()
        theme_color = request.query_params.get('theme_color', '').strip().upper()
        if not template_public_id:
            raise ValidationError({'template_public_id': 'This query parameter is required.'})
        if theme_color and re.fullmatch(r'#[0-9A-F]{6}', theme_color) is None:
            raise ValidationError({'theme_color': 'Use a six-digit hex color.'})
        try:
            template = (
                CvTemplate.objects.select_related(
                    'current_published_version',
                )
                .prefetch_related(
                    'current_published_version__sections__section_definition',
                )
                .get(public_id=template_public_id)
            )
        except CvTemplate.DoesNotExist as error:
            raise Http404 from error
        if (
            theme_color
            and not template.color_links.filter(
                color__hex_code__iexact=theme_color,
                color__is_active=True,
            ).exists()
        ):
            raise ValidationError({'theme_color': 'Color is not available for this template.'})
        try:
            draft = CvDraft.objects.get(cv=cv)
            document = compose_cv_document(
                template=template,
                content_json=draft.content_json,
                theme_color=theme_color or None,
            )
        except CvDraft.DoesNotExist as error:
            raise Http404 from error
        except (CvCompositionError, DjangoValidationError) as error:
            raise ValidationError({'template_public_id': str(error)}) from error
        version = template.current_published_version
        return Response(
            {
                'document': document,
                'renderer': {
                    'key': version.renderer_key,
                    'version': version.renderer_version,
                    'schema_version': version.schema_version,
                    'capabilities': version.capabilities,
                },
                'source_cv_public_id': cv.public_id,
                'lock_version': draft.lock_version,
                'assets': CvDraftSerializer(draft, context={'request': request}).data['assets'],
            }
        )


class CvV2AssetUploadView(APIView):
    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    @extend_schema(
        summary='Tải ảnh đại diện dùng trong CV',
        request=CvAssetUploadSerializer,
        responses={201: CvAssetSerializer},
        tags=['cvs-v2'],
    )
    def post(self, request):
        serializer = CvAssetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = create_avatar_asset(actor=request.user, upload=serializer.validated_data['file'])
        return Response(
            CvAssetSerializer(asset, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class CvV2AssetContentView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary='Nội dung nhị phân của asset CV',
        parameters=[OpenApiParameter('token', str, description='Token truy cập tạm thời')],
        responses={(200, 'application/octet-stream'): OpenApiTypes.BINARY},
        tags=['cvs-v2'],
    )
    def get(self, request, asset_public_id):
        token = request.query_params.get('token')
        try:
            if token:
                asset = resolve_asset_token(token)
                if asset.public_id != asset_public_id:
                    raise CvAsset.DoesNotExist
            else:
                asset = CvAsset.objects.get(public_id=asset_public_id, is_active=True)
                if asset.kind != CvAsset.Kind.BACKGROUND and (
                    not request.user.is_authenticated or asset.owner_id != request.user.pk
                ):
                    raise CvAsset.DoesNotExist
        except CvAsset.DoesNotExist as error:
            raise Http404 from error
        try:
            stream = cv_asset_storage(asset).open(asset.storage_key, 'rb')
        except OSError as error:
            raise Http404 from error
        return FileResponse(stream, content_type=asset.content_type)


class CvV2BackgroundListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        summary='Danh sách ảnh nền dùng chung',
        responses={200: CvAssetSerializer(many=True)},
        tags=['cvs-v2'],
    )
    def get(self, request):
        assets = CvAsset.objects.filter(
            kind=CvAsset.Kind.BACKGROUND,
            owner__isnull=True,
            is_active=True,
        ).order_by('created_at')
        return Response(CvAssetSerializer(assets, many=True, context={'request': request}).data)


class CvV2ApplySampleView(CandidateV2CvMixin, APIView):
    model = UserCv

    @extend_schema(
        summary='Áp nội dung mẫu vào bản nháp',
        request=CvApplySampleSerializer,
        responses={200: CvDraftSerializer, 409: OpenApiTypes.OBJECT},
        tags=['cvs-v2'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        serializer = CvApplySampleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            draft = apply_sample_to_draft(
                cv=cv,
                actor=request.user,
                sample_public_id=serializer.validated_data['sample_content_public_id'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except (CvLifecyclePolicyError, DjangoValidationError) as error:
            detail = (
                error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            )
            raise ValidationError(detail) from error
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )


class CvV2SaveVersionView(CandidateV2CvMixin, APIView):
    model = UserCv
    publish = False

    @extend_schema(
        summary='Lưu bản nháp thành version bất biến',
        request=None,
        responses={201: CvVersionSerializer, 409: OpenApiTypes.OBJECT},
        tags=['cvs-v2'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        try:
            version = save_draft_as_version(
                cv=cv,
                actor=request.user,
                expected_lock_version=expected_lock_version(request),
                publish=self.publish,
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except DjangoValidationError as error:
            detail = error.message_dict if hasattr(error, 'message_dict') else error.messages
            raise ValidationError(detail) from error
        except CvLifecyclePolicyError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvVersionSerializer(version).data, status=status.HTTP_201_CREATED)


class CvV2PublishView(CvV2SaveVersionView):
    publish = True


class CvV2VersionListView(CandidateV2CvMixin, generics.ListAPIView):
    model = UserCv
    serializer_class = CvVersionSummarySerializer

    def get_queryset(self):
        self.get_cv()
        return candidate_cv_versions_queryset(self.request.user, self.kwargs['public_id'])


class CvV2VersionDetailView(CandidateV2CvMixin, generics.RetrieveAPIView):
    model = UserCv
    serializer_class = CvVersionSerializer
    lookup_field = 'public_id'
    lookup_url_kwarg = 'version_public_id'

    def get_queryset(self):
        return candidate_cv_versions_queryset(self.request.user, self.kwargs['public_id'])
