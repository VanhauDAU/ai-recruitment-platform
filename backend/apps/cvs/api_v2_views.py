"""HTTP endpoints for the candidate-owned CV lifecycle V2 API."""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from rest_framework import generics, parsers, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.permissions import IsCandidate
from apps.cv_templates.models import CvTemplate
from apps.cv_templates.services import PositionContentUnavailable
from common.metrics import record_metric
from .composition import CvCompositionError, compose_cv_document

from .api_v2_serializers import (
    CvApplySampleSerializer,
    CvAssetSerializer,
    CvAssetUploadSerializer,
    CvDraftSerializer,
    CvDraftWriteSerializer,
    CvV2DuplicateSerializer,
    CvExportCreateSerializer,
    CvExportSerializer,
    CvV2ImportSerializer,
    CvV2MetadataUpdateSerializer,
    CvSharedLinkCreateSerializer,
    CvSharedLinkSerializer,
    CvTemplateSwitchSerializer,
    CvV2CreateSerializer,
    CvV2Serializer,
    CvVersionSerializer,
    CvVersionSummarySerializer,
    SharedCvVersionSerializer,
)
from .models import CvAsset, CvDraft, CvExport, CvImportJob, CvSharedLink, CvVersion, UserCv
from .selectors import (
    candidate_cv_by_public_id,
    candidate_cv_versions_queryset,
    candidate_cvs_queryset,
    latest_recoverable_cv,
)
from .services import (
    CvLifecyclePolicyError,
    CvExportPermissionError,
    CvExportStateError,
    CvExportUnavailableError,
    CvSharePermissionError,
    CvShareUnavailableError,
    StaleDraftError,
    UnsupportedCvUpload,
    InvalidCvImport,
    create_shared_link,
    create_avatar_asset,
    create_v2_cv,
    duplicate_cv,
    import_v2_cv,
    queue_cv_import,
    retry_import,
    export_download_ready,
    owner_cv_export,
    owner_view_version,
    request_cv_export,
    request_current_cv_thumbnail,
    resolve_shared_link,
    revoke_shared_link,
    retry_cv_export,
    permanently_delete_cv,
    save_draft_as_version,
    switch_draft_template,
    update_cv_metadata,
    update_draft,
    apply_sample_to_draft,
)
from .services.assets import resolve_asset_token


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
            'current_template_version', 'latest_version', 'published_version',
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

    def get(self, request, public_id):
        return Response(CvV2Serializer(self.get_cv(), context={'request': request}).data)

    def patch(self, request, public_id):
        cv = self.get_cv()
        serializer = CvV2MetadataUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_cv = update_cv_metadata(cv=cv, actor=request.user, **serializer.validated_data)
        return Response(CvV2Serializer(updated_cv).data)

    def delete(self, request, public_id):
        try:
            permanently_delete_cv(cv=self.get_cv(), actor=request.user)
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class CvV2DuplicateView(CandidateV2CvMixin, APIView):
    model = UserCv

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

    def get(self, request, public_id):
        cv = self.get_cv()
        links = CvSharedLink.objects.filter(cv=cv).select_related('version').order_by('-created_at')
        return Response(CvSharedLinkSerializer(links, many=True).data)

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

    def get(self, request, token):
        try:
            link, version = resolve_shared_link(raw_token=token, request=request)
        except CvShareUnavailableError as error:
            raise Http404 from error
        return Response(read_only_cv_payload(link.cv, version, request))


class CvV2ExportListCreateView(CandidateV2CvMixin, APIView):
    """Owner-only PDF jobs sourced from immutable versions, never drafts."""
    model = UserCv

    def get(self, request, public_id):
        cv = self.get_cv()
        exports = CvExport.objects.filter(cv=cv).select_related('cv', 'version').order_by('-created_at')
        return Response(CvExportSerializer(exports, many=True, context={'request': request}).data)

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
            detail = error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            raise ValidationError(detail) from error
        status_code = status.HTTP_200_OK if reused else status.HTTP_201_CREATED
        return Response(CvExportSerializer(export, context={'request': request}).data, status=status_code)


class CvV2ExportDetailView(CandidateV2CvMixin, APIView):
    model = UserCv

    def get(self, request, public_id, export_public_id):
        cv = self.get_cv()
        try:
            export = owner_cv_export(cv=cv, actor=request.user, export_public_id=export_public_id)
        except CvExportUnavailableError as error:
            raise Http404 from error
        return Response(CvExportSerializer(export, context={'request': request}).data)


class CvV2ExportRetryView(CandidateV2CvMixin, APIView):
    model = UserCv

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
        return Response(CvExportSerializer(export, context={'request': request}).data, status=status.HTTP_202_ACCEPTED)


class CvV2ExportDownloadView(CandidateV2CvMixin, APIView):
    """Controlled owner download; no storage key or public media URL is exposed."""
    model = UserCv

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
            default_storage.open(export.storage_key, 'rb'),
            as_attachment=True,
            filename=filename,
            content_type='application/pdf',
        )


class CvV2ThumbnailView(CandidateV2CvMixin, APIView):
    """Owner-only first-page image; the private storage key is never serialized."""
    model = UserCv

    def get(self, request, public_id):
        cv = self.get_cv()
        from .services import current_thumbnail_ready

        if not current_thumbnail_ready(cv):
            raise Http404
        return FileResponse(
            default_storage.open(cv.thumbnail_url, 'rb'),
            filename=f'{cv.title or "cv"}-preview.webp',
            content_type='image/webp',
        )

    def post(self, request, public_id):
        try:
            cv = request_current_cv_thumbnail(cv=self.get_cv(), actor=request.user)
        except (ValueError, CvVersion.DoesNotExist) as error:
            raise Http404 from error
        from .services import current_thumbnail_ready

        ready = current_thumbnail_ready(cv)
        payload = CvV2Serializer(cv, context={'request': request}).data
        return Response(
            {'status': 'ready' if ready else 'pending', 'thumbnail_url': payload['thumbnail_url']},
            status=status.HTTP_200_OK if ready else status.HTTP_202_ACCEPTED,
        )


class CvV2DraftView(CandidateV2CvMixin, APIView):
    model = UserCv

    def get(self, request, public_id):
        cv = self.get_cv()
        try:
            draft = CvDraft.objects.select_related('base_version').get(cv=cv)
        except CvDraft.DoesNotExist as error:
            raise Http404 from error
        return Response(CvDraftSerializer(draft, context={'request': request}).data, headers={'ETag': f'"lock-version-{draft.lock_version}"'})

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
        return Response(CvDraftSerializer(draft, context={'request': request}).data, headers={'ETag': f'"lock-version-{draft.lock_version}"'})


class CvV2TemplateSwitchView(CandidateV2CvMixin, APIView):
    """Switch presentation contract while keeping the canonical content immutable."""
    model = UserCv

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
            detail = error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            raise ValidationError(detail) from error
        return Response(
            {'cv': CvV2Serializer(switched_cv).data, 'draft': CvDraftSerializer(draft, context={'request': request}).data},
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )


class CvV2TemplatePreviewView(CandidateV2CvMixin, APIView):
    """Project one owned draft onto a template without mutating either aggregate."""
    model = UserCv

    def get(self, request, public_id):
        cv = self.get_cv()
        template_public_id = request.query_params.get('template_public_id', '').strip()
        theme_color = request.query_params.get('theme_color', '').strip().upper()
        if not template_public_id:
            raise ValidationError({'template_public_id': 'This query parameter is required.'})
        if theme_color and re.fullmatch(r'#[0-9A-F]{6}', theme_color) is None:
            raise ValidationError({'theme_color': 'Use a six-digit hex color.'})
        try:
            template = CvTemplate.objects.select_related(
                'current_published_version',
            ).prefetch_related(
                'current_published_version__sections__section_definition',
            ).get(public_id=template_public_id)
        except CvTemplate.DoesNotExist as error:
            raise Http404 from error
        if theme_color and not template.color_links.filter(
            color__hex_code__iexact=theme_color,
            color__is_active=True,
        ).exists():
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
        return Response({
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
        })


class CvV2AssetUploadView(APIView):
    permission_classes = [IsCandidate]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

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
            stream = default_storage.open(asset.storage_key, 'rb')
        except OSError as error:
            raise Http404 from error
        return FileResponse(stream, content_type=asset.content_type)


class CvV2BackgroundListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        assets = CvAsset.objects.filter(
            kind=CvAsset.Kind.BACKGROUND,
            owner__isnull=True,
            is_active=True,
        ).order_by('created_at')
        return Response(CvAssetSerializer(assets, many=True, context={'request': request}).data)


class CvV2ApplySampleView(CandidateV2CvMixin, APIView):
    model = UserCv

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
            detail = error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            raise ValidationError(detail) from error
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers={'ETag': f'"lock-version-{draft.lock_version}"'},
        )


class CvV2SaveVersionView(CandidateV2CvMixin, APIView):
    model = UserCv
    publish = False

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
