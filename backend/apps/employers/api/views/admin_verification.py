import mimetypes
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from django.http import FileResponse, Http404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.exceptions import AdminPermissionDenied, AdminResourceChanged
from apps.accounts.permissions import HasAdminPermission, require_admin_permission
from apps.accounts.services import (
    InvalidImpactToken,
    StaleImpactToken,
    record_admin_action,
)
from common.pagination import StandardPagination
from common.r2_storage import private_media_storage

from ...models import EmployerVerificationEvent
from ...selectors import admin_verification_cases_queryset, admin_verification_summary
from ...services import (
    confirm_verification_decision,
    render_office_document_preview,
    review_verification_document,
    start_verification_review,
    verification_decision_impact,
)
from ..serializers.admin_verification import (
    AdminVerificationCaseDetailSerializer,
    AdminVerificationCaseListSerializer,
    AdminVerificationDecisionSerializer,
    AdminVerificationDocumentReviewSerializer,
)

GENERIC_CONTENT_TYPES = {'', 'application/octet-stream', 'binary/octet-stream'}
CONTENT_TYPE_ALIASES = {
    'application/x-pdf': 'application/pdf',
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'image/x-png': 'image/png',
}
CONTENT_TYPES_BY_EXTENSION = {
    'avif': 'image/avif',
    'bmp': 'image/bmp',
    'csv': 'text/csv',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'gif': 'image/gif',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'json': 'application/json',
    'pdf': 'application/pdf',
    'png': 'image/png',
    'svg': 'image/svg+xml',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'txt': 'text/plain',
    'webp': 'image/webp',
    'xml': 'application/xml',
}


def _content_type_from_file_name(value):
    path = urlsplit(value or '').path
    extension = PurePosixPath(path).suffix.lower().lstrip('.')
    return CONTENT_TYPES_BY_EXTENSION.get(extension)


def _document_content_type(document):
    stored_type = (document.mime_type or '').partition(';')[0].strip().lower()
    if stored_type not in GENERIC_CONTENT_TYPES:
        return CONTENT_TYPE_ALIASES.get(stored_type, stored_type)
    for candidate in (document.file_name, document.file_url):
        explicit_type = _content_type_from_file_name(candidate)
        if explicit_type:
            return explicit_type
        guessed_type, _ = mimetypes.guess_type(candidate or '')
        if guessed_type:
            return CONTENT_TYPE_ALIASES.get(guessed_type, guessed_type)
    return 'application/octet-stream'


def _supports_inline_preview(content_type):
    return (
        content_type == 'application/pdf'
        or content_type.startswith('image/')
        or content_type.startswith('text/')
        or content_type in {'application/json', 'application/xml'}
    )


def _can_view_sensitive(user):
    if user.is_superuser:
        return True
    try:
        require_admin_permission(user, 'account.sensitive.view')
    except AdminPermissionDenied:
        return False
    return True


class AdminEmployerVerificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['employer_verification.view'],
        'retrieve': ['employer_verification.view'],
        'summary': ['employer_verification.view'],
        'start_review': ['employer_verification.review'],
        'review_document': ['employer_verification.review'],
        'decision_impact': ['employer_verification.review'],
        'decision': ['employer_verification.review'],
        'document_content': [
            'employer_verification.view',
            'account.sensitive.view',
        ],
    }

    def get_queryset(self):
        return admin_verification_cases_queryset(params=self.request.query_params)

    def get_serializer_class(self):
        if self.action == 'list':
            return AdminVerificationCaseListSerializer
        return AdminVerificationCaseDetailSerializer

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            'can_view_sensitive': _can_view_sensitive(self.request.user),
        }

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(admin_verification_summary())

    @action(detail=True, methods=['post'], url_path='start-review')
    def start_review(self, request, public_id=None):
        case = start_verification_review(self.get_object(), actor=request.user)
        current = admin_verification_cases_queryset().get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    @action(
        detail=True,
        methods=['post'],
        url_path=r'documents/(?P<document_public_id>[^/.]+)/review',
    )
    def review_document(self, request, public_id=None, document_public_id=None):
        case = self.get_object()
        document = case.documents.filter(
            public_id=document_public_id,
            is_current=True,
        ).first()
        if document is None:
            raise Http404
        serializer = AdminVerificationDocumentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            _, case = review_verification_document(
                document,
                actor=request.user,
                **serializer.validated_data,
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        current = admin_verification_cases_queryset().get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    @action(detail=True, methods=['post'], url_path='decision-impact')
    def decision_impact(self, request, public_id=None):
        serializer = AdminVerificationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        return Response(
            verification_decision_impact(
                self.get_object(),
                decision=values['decision'],
                reason=values.get('reason', ''),
            )
        )

    @action(detail=True, methods=['post'])
    def decision(self, request, public_id=None):
        serializer = AdminVerificationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if not values.get('impact_token'):
            raise ValidationError({'impact_token': 'Vui lòng xem tác động trước khi xác nhận.'})
        try:
            case = confirm_verification_decision(
                self.get_object(),
                actor=request.user,
                decision=values['decision'],
                reason=values.get('reason', ''),
                impact_token=values['impact_token'],
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        except InvalidImpactToken as error:
            raise ValidationError({'impact_token': str(error)}) from error
        current = admin_verification_cases_queryset().get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    @action(
        detail=True,
        methods=['get'],
        url_path=r'documents/(?P<document_public_id>[^/.]+)/content',
    )
    def document_content(self, request, public_id=None, document_public_id=None):
        document = (
            self.get_object()
            .documents.filter(public_id=document_public_id)
            .select_related('verification_case')
            .first()
        )
        if document is None or document.file_url.startswith(('http://', 'https://')):
            raise Http404
        intent = request.query_params.get('intent', 'preview')
        if intent not in {'preview', 'download'}:
            intent = 'preview'
        EmployerVerificationEvent.objects.create(
            verification_case=document.verification_case,
            actor=request.user,
            event_type=EmployerVerificationEvent.EventType.SENSITIVE_VIEWED,
            payload={
                'document_public_id': document.public_id,
                'document_file_name': document.file_name,
                'document_type': document.doc_type,
                'document_type_label': document.get_doc_type_display(),
                'action': intent,
                'audit_version': 2,
            },
        )
        record_admin_action(
            actor=request.user,
            action=f'{intent}_employer_verification_document',
            target_type='employer_verification_document',
            target_public_id=document.public_id,
            payload={'case_public_id': document.verification_case.public_id},
        )
        content_type = _document_content_type(document)
        if intent == 'preview':
            preview = render_office_document_preview(document.file_url, content_type)
            if preview is not None:
                return FileResponse(
                    BytesIO(preview),
                    content_type='application/pdf',
                    filename=f'{document.public_id}.pdf',
                    as_attachment=False,
                )
        try:
            stream = private_media_storage().open(document.file_url, 'rb')
        except (FileNotFoundError, OSError) as error:
            raise Http404 from error
        response = FileResponse(
            stream,
            content_type=content_type,
            filename=document.file_name or f'{document.public_id}.bin',
            as_attachment=not _supports_inline_preview(content_type),
        )
        response['Cache-Control'] = 'private, no-store'
        return response
