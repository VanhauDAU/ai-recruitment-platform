"""HTTP endpoints for the candidate-owned CV lifecycle V2 API."""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from rest_framework import generics, parsers, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from .api_v2_serializers import (
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
from .models import CvDraft, CvExport, CvSharedLink, UserCv
from .selectors import (
    candidate_archived_cv_by_public_id,
    candidate_archived_cvs_queryset,
    candidate_cv_by_public_id,
    candidate_cv_versions_queryset,
    candidate_cvs_queryset,
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
    archive_cv,
    create_shared_link,
    create_v2_cv,
    duplicate_cv,
    import_v2_cv,
    export_download_ready,
    owner_cv_export,
    owner_view_version,
    request_cv_export,
    resolve_shared_link,
    revoke_shared_link,
    retry_cv_export,
    restore_cv,
    save_draft_as_version,
    switch_draft_template,
    update_cv_metadata,
    update_draft,
)


LOCK_HEADER_RE = re.compile(r'^"?lock-version-(\d+)"?$')


def expected_lock_version(request):
    value = request.headers.get('If-Match', '')
    match = LOCK_HEADER_RE.fullmatch(value.strip())
    if match is None:
        raise ValidationError({'If-Match': 'Use If-Match: "lock-version-<number>".'})
    return int(match.group(1))


def draft_conflict_response(cv):
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
                theme_color=serializer.validated_data.get('theme_color'),
            )
        except CvLifecyclePolicyError as error:
            raise PermissionDenied(str(error)) from error
        return Response(CvV2Serializer(cv).data, status=status.HTTP_201_CREATED)


class CvV2DetailView(CandidateV2CvMixin, APIView):
    model = UserCv

    def get(self, request, public_id):
        return Response(CvV2Serializer(self.get_cv()).data)

    def patch(self, request, public_id):
        cv = self.get_cv()
        serializer = CvV2MetadataUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_cv = update_cv_metadata(cv=cv, actor=request.user, **serializer.validated_data)
        return Response(CvV2Serializer(updated_cv).data)

    def delete(self, request, public_id):
        archive_cv(self.get_cv())
        return Response(status=status.HTTP_204_NO_CONTENT)


class CvV2ArchivedListView(generics.ListAPIView):
    permission_classes = [IsCandidate]
    serializer_class = CvV2Serializer

    def get_queryset(self):
        return candidate_archived_cvs_queryset(self.request.user)


class CvV2RestoreView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request, public_id):
        try:
            cv = candidate_archived_cv_by_public_id(request.user, public_id)
        except UserCv.DoesNotExist as error:
            raise Http404 from error
        try:
            restored_cv = restore_cv(cv=cv, actor=request.user)
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(CvV2Serializer(restored_cv).data)


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

    def post(self, request):
        serializer = CvV2ImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            cv = import_v2_cv(
                actor=request.user,
                upload=serializer.validated_data['file'],
                title=serializer.validated_data.get('title', ''),
            )
        except UnsupportedCvUpload as error:
            raise ValidationError({'file': str(error)}) from error
        return Response(CvV2Serializer(cv).data, status=status.HTTP_201_CREATED)


def read_only_cv_payload(cv, version):
    return {
        'cv': {
            'public_id': cv.public_id,
            'title': cv.title,
            'language': cv.language,
            'is_default': cv.is_default,
        },
        'version': SharedCvVersionSerializer(version).data,
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
        return Response(read_only_cv_payload(cv, version))


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
        return Response(read_only_cv_payload(link.cv, version))


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


class CvV2DraftView(CandidateV2CvMixin, APIView):
    model = UserCv

    def get(self, request, public_id):
        cv = self.get_cv()
        try:
            draft = CvDraft.objects.select_related('base_version').get(cv=cv)
        except CvDraft.DoesNotExist as error:
            raise Http404 from error
        return Response(CvDraftSerializer(draft).data, headers={'ETag': f'"lock-version-{draft.lock_version}"'})

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
        return Response(CvDraftSerializer(draft).data, headers={'ETag': f'"lock-version-{draft.lock_version}"'})


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
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except (CvLifecyclePolicyError, DjangoValidationError) as error:
            detail = error.message_dict if hasattr(error, 'message_dict') else {'detail': str(error)}
            raise ValidationError(detail) from error
        return Response(
            {'cv': CvV2Serializer(switched_cv).data, 'draft': CvDraftSerializer(draft).data},
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
