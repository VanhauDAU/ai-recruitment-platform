import mimetypes
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from django.db.models import Prefetch, Q
from django.db.models.expressions import RawSQL
from django.http import FileResponse, Http404
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    PolymorphicProxySerializer,
    extend_schema,
)
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

from ...models import (
    CompanyTaxLookupEvidence,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    Industry,
)
from ...selectors import admin_verification_cases_queryset, admin_verification_summary
from ...services import (
    CompanyTaxCodeConflict,
    apply_update_request,
    confirm_verification_decision,
    confirm_verification_lifecycle_action,
    refresh_company_update_tax_lookup,
    refresh_verification_tax_lookup,
    render_office_document_preview,
    review_company_update_document,
    review_verification_document,
    start_verification_review,
    unlock_verification_resubmission,
    verification_decision_impact,
    verification_lifecycle_impact,
)
from ..exceptions import CompanyTaxCodeConflictResponse
from ..serializers.admin_verification import (
    AdminCompanyUpdateRequestSerializer,
    AdminCompanyUpdateReviewSerializer,
    AdminVerificationCaseDetailSerializer,
    AdminVerificationCaseListSerializer,
    AdminVerificationDecisionConfirmationSerializer,
    AdminVerificationDecisionFieldErrorSerializer,
    AdminVerificationDecisionImpactSerializer,
    AdminVerificationDecisionPreviewSerializer,
    AdminVerificationDecisionWorkflowErrorSerializer,
    AdminVerificationDocumentReviewSerializer,
    AdminVerificationLifecycleConfirmationSerializer,
    AdminVerificationLifecycleFieldErrorSerializer,
    AdminVerificationLifecycleImpactSerializer,
    AdminVerificationLifecyclePreviewSerializer,
    AdminVerificationLifecycleWorkflowErrorSerializer,
    AdminVerificationPermissionErrorSerializer,
    AdminVerificationResubmissionUnlockSerializer,
    AdminVerificationStaleErrorSerializer,
    AdminVerificationTaxConflictErrorSerializer,
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

ADMIN_VERIFICATION_DECISION_BAD_REQUEST_SCHEMA = PolymorphicProxySerializer(
    component_name='AdminVerificationDecisionBadRequest',
    serializers=[
        AdminVerificationDecisionWorkflowErrorSerializer,
        AdminVerificationDecisionFieldErrorSerializer,
    ],
    resource_type_field_name=None,
)
ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_SCHEMA = PolymorphicProxySerializer(
    component_name='AdminVerificationLifecycleBadRequest',
    serializers=[
        AdminVerificationLifecycleWorkflowErrorSerializer,
        AdminVerificationLifecycleFieldErrorSerializer,
    ],
    resource_type_field_name=None,
)
ADMIN_VERIFICATION_DECISION_CONFLICT_SCHEMA = PolymorphicProxySerializer(
    component_name='AdminVerificationDecisionConflict',
    serializers=[
        AdminVerificationStaleErrorSerializer,
        AdminVerificationTaxConflictErrorSerializer,
    ],
    resource_type_field_name=None,
)
ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE = OpenApiResponse(
    response=ADMIN_VERIFICATION_DECISION_BAD_REQUEST_SCHEMA,
    description=(
        'Payload không hợp lệ hoặc vi phạm state machine. Lỗi nghiệp vụ trả '
        '`code` ổn định; lỗi field-level trả mảng thông báo theo tên field.'
    ),
    examples=[
        OpenApiExample(
            'Invalid transition',
            value={
                'code': 'VERIFICATION_INVALID_TRANSITION',
                'detail': 'Quyết định cuối chỉ áp dụng cho hồ sơ đang được review.',
                'current_status': 'pending',
                'allowed_statuses': ['in_review'],
            },
            response_only=True,
        ),
        OpenApiExample(
            'Tax lookup pending',
            value={
                'code': 'TAX_LOOKUP_PENDING',
                'detail': 'Đang chờ kết quả tra cứu mã số thuế.',
            },
            response_only=True,
        ),
        OpenApiExample(
            'Field validation',
            value={'impact_token': ['Vui lòng xem tác động trước khi xác nhận.']},
            response_only=True,
        ),
    ],
)
ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE = OpenApiResponse(
    response=ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_SCHEMA,
    description=(
        'Payload không hợp lệ hoặc vi phạm state machine. Lỗi nghiệp vụ trả '
        '`code` ổn định; lỗi field-level trả mảng thông báo theo tên field.'
    ),
    examples=[
        OpenApiExample(
            'Invalid transition',
            value={
                'code': 'VERIFICATION_INVALID_TRANSITION',
                'detail': 'Chỉ hồ sơ đã duyệt mới có thể bị thu hồi hoặc hết hiệu lực.',
                'current_status': 'pending',
                'allowed_statuses': ['approved'],
            },
            response_only=True,
        ),
        OpenApiExample(
            'Field validation',
            value={'impact_token': ['Vui lòng xem tác động trước khi xác nhận.']},
            response_only=True,
        ),
    ],
)
ADMIN_VERIFICATION_PERMISSION_RESPONSE = OpenApiResponse(
    response=AdminVerificationPermissionErrorSerializer,
    description='Thiếu permission quản trị bắt buộc cho action.',
    examples=[
        OpenApiExample(
            'Permission denied',
            value={
                'code': 'admin_permission_denied',
                'message': 'Bạn không có quyền thực hiện hành động này.',
            },
            response_only=True,
        )
    ],
)
ADMIN_VERIFICATION_DECISION_CONFLICT_RESPONSE = OpenApiResponse(
    response=ADMIN_VERIFICATION_DECISION_CONFLICT_SCHEMA,
    description=(
        'Preview đã stale (`admin_resource_changed`) hoặc mã số thuế đã '
        'được xác thực cho công ty khác (`company_tax_code_conflict`).'
    ),
    examples=[
        OpenApiExample(
            'Stale impact preview',
            value={
                'code': 'admin_resource_changed',
                'message': ('Dữ liệu đã thay đổi. Vui lòng xem lại tác động trước khi tiếp tục.'),
            },
            response_only=True,
        ),
        OpenApiExample(
            'Company tax code conflict',
            value={
                'code': 'company_tax_code_conflict',
                'message': 'Mã số thuế đã thuộc một công ty được xác thực.',
            },
            response_only=True,
        ),
    ],
)
ADMIN_VERIFICATION_TAX_CONFLICT_RESPONSE = OpenApiResponse(
    response=AdminVerificationTaxConflictErrorSerializer,
    description='Mã số thuế đã được xác thực cho công ty khác.',
    examples=[
        OpenApiExample(
            'Company tax code conflict',
            value={
                'code': 'company_tax_code_conflict',
                'message': 'Mã số thuế đã thuộc một công ty được xác thực.',
            },
            response_only=True,
        )
    ],
)
ADMIN_VERIFICATION_STALE_RESPONSE = OpenApiResponse(
    response=AdminVerificationStaleErrorSerializer,
    description='Preview đã stale; client phải gọi lại endpoint impact.',
    examples=[
        OpenApiExample(
            'Stale impact preview',
            value={
                'code': 'admin_resource_changed',
                'message': ('Dữ liệu đã thay đổi. Vui lòng xem lại tác động trước khi tiếp tục.'),
            },
            response_only=True,
        )
    ],
)


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
        'revoke_impact': ['employer_verification.revoke'],
        'revoke': ['employer_verification.revoke'],
        'expire_impact': ['employer_verification.revoke'],
        'expire': ['employer_verification.revoke'],
        'unlock_resubmission': ['employer_verification.resubmission_unlock'],
        'refresh_tax_lookup': ['employer_verification.review'],
        'document_content': [
            'employer_verification.view',
            'account.sensitive.view',
        ],
    }

    def get_queryset(self):
        return admin_verification_cases_queryset(
            params=self.request.query_params,
            include_detail=self.action != 'list',
        )

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
        current = admin_verification_cases_queryset(include_detail=True).get(pk=case.pk)
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
        except CompanyTaxCodeConflict as error:
            raise CompanyTaxCodeConflictResponse(
                error.tax_code,
                claim_status=error.claim_status,
            ) from error
        current = admin_verification_cases_queryset(include_detail=True).get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(
        summary='Preview tác động quyết định cuối hồ sơ xác thực',
        description=(
            'Bước 1/2, không ghi dữ liệu. Yêu cầu '
            '`employer_verification.review`. Chỉ case `in_review` được quyết '
            'định. Tax `pending` luôn bị chặn; các trạng thái advisory còn '
            'lại cần `tax_override=true`, permission '
            '`employer_verification.tax_override` và `tax_override_reason` không rỗng.'
        ),
        request=AdminVerificationDecisionPreviewSerializer,
        responses={
            200: AdminVerificationDecisionImpactSerializer,
            400: ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
            409: ADMIN_VERIFICATION_TAX_CONFLICT_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'], url_path='decision-impact')
    def decision_impact(self, request, public_id=None):
        serializer = AdminVerificationDecisionPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            impact = verification_decision_impact(
                self.get_object(),
                actor=request.user,
                decision=values['decision'],
                reason=values.get('reason', ''),
                tax_override=values.get('tax_override', False),
                tax_override_reason=values.get('tax_override_reason', ''),
            )
        except CompanyTaxCodeConflict as error:
            raise CompanyTaxCodeConflictResponse(
                error.tax_code,
                claim_status=error.claim_status,
            ) from error
        return Response(impact)

    @extend_schema(
        summary='Xác nhận quyết định cuối hồ sơ xác thực',
        description=(
            'Bước 2/2. `impact_token` bắt buộc và được ràng buộc với '
            'revision, request và snapshot đã preview. Trả `409 '
            'admin_resource_changed` nếu bất kỳ dữ liệu ảnh hưởng nào thay đổi; '
            'client phải preview lại. Approve xác thực company nhưng reapprove '
            'chỉ gỡ compliance hold nguồn verification.'
        ),
        request=AdminVerificationDecisionConfirmationSerializer,
        responses={
            200: AdminVerificationCaseDetailSerializer,
            400: ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
            409: ADMIN_VERIFICATION_DECISION_CONFLICT_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'])
    def decision(self, request, public_id=None):
        serializer = AdminVerificationDecisionConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            case = confirm_verification_decision(
                self.get_object(),
                actor=request.user,
                decision=values['decision'],
                reason=values.get('reason', ''),
                impact_token=values['impact_token'],
                tax_override=values.get('tax_override', False),
                tax_override_reason=values.get('tax_override_reason', ''),
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        except InvalidImpactToken as error:
            raise ValidationError({'impact_token': str(error)}) from error
        except CompanyTaxCodeConflict as error:
            raise CompanyTaxCodeConflictResponse(
                error.tax_code,
                claim_status=error.claim_status,
            ) from error
        current = admin_verification_cases_queryset(include_detail=True).get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(
        summary='Mở khóa ngoại lệ cho phép nộp lại hồ sơ xác thực',
        description=(
            'Chỉ áp dụng cho case `rejected` đã khóa sau khi đạt giới hạn từ chối '
            'cuối. Yêu cầu permission `employer_verification.resubmission_unlock`, '
            'lý do audit và `lock_version` hiện hành. Thao tác không xóa lịch sử '
            'từ chối và không tự duyệt hồ sơ.'
        ),
        request=AdminVerificationResubmissionUnlockSerializer,
        responses={
            200: AdminVerificationCaseDetailSerializer,
            400: ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
            409: ADMIN_VERIFICATION_DECISION_CONFLICT_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'], url_path='unlock-resubmission')
    def unlock_resubmission(self, request, public_id=None):
        serializer = AdminVerificationResubmissionUnlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            case = unlock_verification_resubmission(
                self.get_object(),
                actor=request.user,
                **serializer.validated_data,
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        current = admin_verification_cases_queryset(include_detail=True).get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    def _lifecycle_impact(self, request, action):
        serializer = AdminVerificationLifecyclePreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            verification_lifecycle_impact(
                self.get_object(),
                actor=request.user,
                action=action,
                reason=serializer.validated_data['reason'],
            )
        )

    def _confirm_lifecycle(self, request, action):
        serializer = AdminVerificationLifecycleConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            case = confirm_verification_lifecycle_action(
                self.get_object(),
                actor=request.user,
                action=action,
                reason=values['reason'],
                impact_token=values['impact_token'],
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        except InvalidImpactToken as error:
            raise ValidationError({'impact_token': str(error)}) from error
        current = admin_verification_cases_queryset(include_detail=True).get(pk=case.pk)
        return Response(
            AdminVerificationCaseDetailSerializer(
                current,
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(
        summary='Preview tác động thu hồi xác thực recruiter',
        description=(
            'Bước 1/2, không ghi dữ liệu. Yêu cầu '
            '`employer_verification.revoke`; chỉ case `approved` hợp lệ. '
            'Thu hồi không downgrade company, nhưng khi confirm sẽ chặn '
            'candidate-data/job approval và ẩn active public jobs thuộc recruiter.'
        ),
        request=AdminVerificationLifecyclePreviewSerializer,
        responses={
            200: AdminVerificationLifecycleImpactSerializer,
            400: ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'], url_path='revoke-impact')
    def revoke_impact(self, request, public_id=None):
        return self._lifecycle_impact(request, EmployerVerificationCase.Status.REVOKED)

    @extend_schema(
        summary='Xác nhận thu hồi xác thực recruiter',
        description=(
            'Bước 2/2. Yêu cầu `employer_verification.revoke` và '
            '`impact_token` còn hiệu lực. Tạo compliance hold nguồn verification '
            'với reason `verification_revoked`; không thay đổi company verification.'
        ),
        request=AdminVerificationLifecycleConfirmationSerializer,
        responses={
            200: AdminVerificationCaseDetailSerializer,
            400: ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
            409: ADMIN_VERIFICATION_STALE_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'])
    def revoke(self, request, public_id=None):
        return self._confirm_lifecycle(request, EmployerVerificationCase.Status.REVOKED)

    @extend_schema(
        summary='Preview tác động đánh dấu xác thực hết hiệu lực',
        description=(
            'Bước 1/2, thao tác manual của ER-5 và không ghi dữ liệu. '
            'Yêu cầu `employer_verification.revoke`; chỉ case `approved` hợp lệ. '
            'Company không bị downgrade.'
        ),
        request=AdminVerificationLifecyclePreviewSerializer,
        responses={
            200: AdminVerificationLifecycleImpactSerializer,
            400: ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'], url_path='expire-impact')
    def expire_impact(self, request, public_id=None):
        return self._lifecycle_impact(request, EmployerVerificationCase.Status.EXPIRED)

    @extend_schema(
        summary='Xác nhận xác thực recruiter hết hiệu lực',
        description=(
            'Bước 2/2. Yêu cầu `employer_verification.revoke` và '
            '`impact_token` còn hiệu lực. Tạo compliance hold nguồn verification '
            'với reason `verification_expired`; không thay đổi company verification.'
        ),
        request=AdminVerificationLifecycleConfirmationSerializer,
        responses={
            200: AdminVerificationCaseDetailSerializer,
            400: ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
            409: ADMIN_VERIFICATION_STALE_RESPONSE,
        },
    )
    @action(detail=True, methods=['post'])
    def expire(self, request, public_id=None):
        return self._confirm_lifecycle(request, EmployerVerificationCase.Status.EXPIRED)

    @action(detail=True, methods=['post'], url_path='refresh-tax-lookup')
    def refresh_tax_lookup(self, request, public_id=None):
        try:
            case, _ = refresh_verification_tax_lookup(
                self.get_object(),
                actor=request.user,
            )
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        current = admin_verification_cases_queryset(include_detail=True).get(pk=case.pk)
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


class AdminCompanyUpdateRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin review workflow for staged company-profile changes."""

    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    serializer_class = AdminCompanyUpdateRequestSerializer
    required_admin_permissions = {
        'list': ['company_update.view'],
        'retrieve': ['company_update.view'],
        'review_document': ['company_update.review'],
        'review': ['company_update.review'],
        'refresh_tax_lookup': ['company_update.review'],
        'document_content': [
            'company_update.view',
            'account.sensitive.view',
        ],
    }

    def get_queryset(self):
        queryset = CompanyUpdateRequest.objects.select_related(
            'company',
            'requested_by',
            'reviewed_by',
        ).prefetch_related(
            'documents__uploaded_by',
            'documents__reviewed_by',
            'company__company_industries__industry',
            Prefetch(
                'tax_lookup_evidences',
                queryset=CompanyTaxLookupEvidence.objects.order_by('-created_at', '-id'),
            ),
        )
        params = self.request.query_params
        if params.get('status'):
            queryset = queryset.filter(status=params['status'])
        if params.get('company'):
            queryset = queryset.filter(company__public_id=params['company'])
        query = (params.get('q') or '').strip()
        if query:
            queryset = queryset.filter(
                Q(public_id__icontains=query)
                | Q(company__company_name__icontains=query)
                | Q(company__tax_code__icontains=query)
                | Q(requested_by__email__icontains=query)
            )
        ordering = params.get('ordering', '-updated_at')
        if ordering in {'change_count', '-change_count'}:
            queryset = queryset.annotate(
                change_count=RawSQL(
                    '(SELECT COUNT(*) FROM '
                    'jsonb_object_keys(employers_companyupdaterequest.changes))',
                    (),
                )
            )
        allowed = {
            'company__company_name',
            '-company__company_name',
            'requested_by__email',
            '-requested_by__email',
            'change_count',
            '-change_count',
            'is_sensitive',
            '-is_sensitive',
            'updated_at',
            '-updated_at',
        }
        return queryset.order_by(
            ordering if ordering in allowed else '-updated_at',
            '-id',
        )

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            'can_view_sensitive': _can_view_sensitive(self.request.user),
            'industry_labels': dict(Industry.objects.values_list('id', 'name')),
        }

    @action(
        detail=True,
        methods=['post'],
        url_path=r'documents/(?P<document_public_id>[^/.]+)/review',
    )
    def review_document(self, request, public_id=None, document_public_id=None):
        update_request = self.get_object()
        document = update_request.documents.filter(
            public_id=document_public_id,
            is_current=True,
        ).first()
        if document is None:
            raise Http404
        serializer = AdminVerificationDocumentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            _, update_request = review_company_update_document(
                document,
                admin_user=request.user,
                decision=values['decision'],
                note=values.get('reason', ''),
                lock_version=values['lock_version'],
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        current = self.get_queryset().get(pk=update_request.pk)
        return Response(self.get_serializer(current).data)

    @action(detail=True, methods=['post'])
    def review(self, request, public_id=None):
        serializer = AdminCompanyUpdateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            update_request = apply_update_request(
                self.get_object(),
                request.user,
                approve=values['decision'] == CompanyUpdateRequest.Status.APPROVED,
                note=values.get('note', ''),
                lock_version=values['lock_version'],
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        except CompanyTaxCodeConflict as error:
            raise CompanyTaxCodeConflictResponse(
                error.tax_code,
                claim_status=error.claim_status,
            ) from error
        current = self.get_queryset().get(pk=update_request.pk)
        return Response(self.get_serializer(current).data)

    @action(detail=True, methods=['post'], url_path='refresh-tax-lookup')
    def refresh_tax_lookup(self, request, public_id=None):
        try:
            update_request, _ = refresh_company_update_tax_lookup(
                self.get_object(),
                actor=request.user,
            )
        except ValueError as error:
            raise ValidationError({'detail': str(error)}) from error
        current = self.get_queryset().get(pk=update_request.pk)
        return Response(self.get_serializer(current).data)

    @action(
        detail=True,
        methods=['get'],
        url_path=r'documents/(?P<document_public_id>[^/.]+)/content',
    )
    def document_content(self, request, public_id=None, document_public_id=None):
        document = (
            self.get_object()
            .documents.filter(
                public_id=document_public_id,
            )
            .first()
        )
        if document is None or document.file_url.startswith(('http://', 'https://')):
            raise Http404
        record_admin_action(
            actor=request.user,
            action='view_company_update_document',
            target_type='company_update_document',
            target_public_id=document.public_id,
            payload={'update_request_public_id': document.update_request.public_id},
        )
        content_type = _document_content_type(document)
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
