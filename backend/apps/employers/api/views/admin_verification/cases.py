"""Admin queue and two-step decisions on employer verification cases."""

from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission
from apps.accounts.services import AdminResourceChanged, InvalidImpactToken, StaleImpactToken

from ....models import EmployerVerificationCase
from ....selectors import admin_verification_cases_queryset, admin_verification_summary
from ....services import (
    confirm_verification_decision,
    confirm_verification_lifecycle_action,
    record_verification_document_access,
    refresh_verification_tax_lookup,
    review_verification_document,
    start_verification_review,
    unlock_verification_resubmission,
    verification_decision_impact,
    verification_lifecycle_impact,
)
from ...serializers.admin_verification import (
    AdminVerificationCaseDetailSerializer,
    AdminVerificationCaseListSerializer,
    AdminVerificationDecisionConfirmationSerializer,
    AdminVerificationDecisionImpactSerializer,
    AdminVerificationDecisionPreviewSerializer,
    AdminVerificationDocumentReviewSerializer,
    AdminVerificationLifecycleConfirmationSerializer,
    AdminVerificationLifecycleImpactSerializer,
    AdminVerificationLifecyclePreviewSerializer,
    AdminVerificationResubmissionUnlockSerializer,
)
from .documents import (
    DOCUMENT_CONTENT_RESPONSE,
    DOCUMENT_PUBLIC_ID_PARAMETER,
    private_document_response,
)
from .responses import (
    ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE,
    ADMIN_VERIFICATION_LIFECYCLE_BAD_REQUEST_RESPONSE,
    ADMIN_VERIFICATION_PERMISSION_RESPONSE,
    ADMIN_VERIFICATION_STALE_RESPONSE,
)


@extend_schema_view(
    list=extend_schema(summary='Hàng đợi hồ sơ xác thực nhà tuyển dụng'),
    retrieve=extend_schema(
        summary='Chi tiết hồ sơ xác thực',
        responses={200: AdminVerificationCaseDetailSerializer},
    ),
)
class AdminEmployerVerificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AdminPortalPermission]
    lookup_field = 'public_id'

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
            'can_view_sensitive': True,
        }

    @extend_schema(
        summary='Số liệu tổng quan hàng đợi xác thực',
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(admin_verification_summary())

    @extend_schema(
        summary='Nhận thẩm định hồ sơ xác thực',
        request=None,
        responses={200: AdminVerificationCaseDetailSerializer},
    )
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

    @extend_schema(
        summary='Duyệt một giấy tờ của hồ sơ xác thực',
        parameters=[DOCUMENT_PUBLIC_ID_PARAMETER],
        request=AdminVerificationDocumentReviewSerializer,
        responses={200: AdminVerificationCaseDetailSerializer},
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
        },
    )
    @action(detail=True, methods=['post'], url_path='decision-impact')
    def decision_impact(self, request, public_id=None):
        serializer = AdminVerificationDecisionPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        impact = verification_decision_impact(
            self.get_object(),
            actor=request.user,
            decision=values['decision'],
            reason=values.get('reason', ''),
            tax_override=values.get('tax_override', False),
            tax_override_reason=values.get('tax_override_reason', ''),
        )
        return Response(impact)

    @extend_schema(
        summary='Xác nhận quyết định cuối hồ sơ xác thực',
        description=(
            'Bước 2/2. `impact_token` bắt buộc và được ràng buộc với '
            'revision, request và snapshot đã preview. Trả `409 '
            'admin_resource_changed` nếu bất kỳ dữ liệu ảnh hưởng nào thay đổi; '
            'client phải preview lại. Approve chỉ xác thực recruiter; reapprove '
            'đồng thời gỡ compliance hold nguồn verification.'
        ),
        request=AdminVerificationDecisionConfirmationSerializer,
        responses={
            200: AdminVerificationCaseDetailSerializer,
            400: ADMIN_VERIFICATION_DECISION_BAD_REQUEST_RESPONSE,
            403: ADMIN_VERIFICATION_PERMISSION_RESPONSE,
            409: ADMIN_VERIFICATION_STALE_RESPONSE,
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
            409: ADMIN_VERIFICATION_STALE_RESPONSE,
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
            'Khi confirm sẽ chặn '
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
            'với reason `verification_revoked` cho recruiter.'
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
            'Yêu cầu `employer_verification.revoke`; chỉ case `approved` hợp lệ.'
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
            'với reason `verification_expired` cho recruiter.'
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

    @extend_schema(
        summary='Tra cứu lại mã số thuế của hồ sơ xác thực',
        request=None,
        responses={200: AdminVerificationCaseDetailSerializer},
    )
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

    @extend_schema(
        summary='Xem hoặc tải giấy tờ xác thực (ghi nhật ký truy cập)',
        parameters=[
            DOCUMENT_PUBLIC_ID_PARAMETER,
            OpenApiParameter(
                'intent',
                str,
                OpenApiParameter.QUERY,
                enum=['preview', 'download'],
                required=False,
            ),
        ],
        responses=DOCUMENT_CONTENT_RESPONSE,
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
        record_verification_document_access(document, actor=request.user, intent=intent)
        return private_document_response(document, render_preview=intent == 'preview')
