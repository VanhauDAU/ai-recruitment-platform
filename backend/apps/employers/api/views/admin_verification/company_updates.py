"""Admin review workflow for staged company-profile changes."""

from django.http import Http404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission
from apps.accounts.services import AdminResourceChanged, StaleImpactToken, record_admin_action

from ....models import CompanyUpdateRequest
from ....selectors import admin_company_update_requests_queryset, industry_labels
from ....services import (
    CompanyUpdateConflict,
    apply_update_request,
    refresh_company_update_tax_lookup,
    review_company_update_document,
    start_company_update_review,
)
from ...exceptions import CompanyUpdateConflictResponse
from ...serializers.admin_verification import (
    AdminCompanyUpdateRequestSerializer,
    AdminCompanyUpdateReviewSerializer,
    AdminCompanyUpdateStartReviewSerializer,
    AdminVerificationDocumentReviewSerializer,
)
from .documents import (
    DOCUMENT_CONTENT_RESPONSE,
    DOCUMENT_PUBLIC_ID_PARAMETER,
    private_document_response,
)


@extend_schema_view(
    list=extend_schema(summary='Hàng đợi yêu cầu cập nhật công ty'),
    retrieve=extend_schema(summary='Chi tiết yêu cầu cập nhật công ty'),
)
class AdminCompanyUpdateRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin review workflow for staged company-profile changes."""

    permission_classes = [AdminPortalPermission]
    lookup_field = 'public_id'
    serializer_class = AdminCompanyUpdateRequestSerializer

    def get_queryset(self):
        return admin_company_update_requests_queryset(params=self.request.query_params)

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            'can_view_sensitive': True,
            'industry_labels': industry_labels(),
        }

    @extend_schema(
        summary='Duyệt tài liệu của phiên bản yêu cầu cập nhật công ty hiện tại',
        parameters=[DOCUMENT_PUBLIC_ID_PARAMETER],
        request=AdminVerificationDocumentReviewSerializer,
        responses={200: AdminCompanyUpdateRequestSerializer},
    )
    @action(
        detail=True,
        methods=['post'],
        url_path=r'documents/(?P<document_public_id>[^/.]+)/review',
    )
    def review_document(self, request, public_id=None, document_public_id=None):
        update_request = self.get_object()
        if update_request.status != CompanyUpdateRequest.Status.IN_REVIEW:
            raise ValidationError(
                {'detail': 'Phải nhận thẩm định yêu cầu trước khi xử lý giấy tờ.'}
            )
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
                revision_public_id=values.get('revision_public_id', ''),
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        current = self.get_queryset().get(pk=update_request.pk)
        return Response(self.get_serializer(current).data)

    @extend_schema(
        summary='Nhận thẩm định yêu cầu cập nhật công ty',
        request=AdminCompanyUpdateStartReviewSerializer,
        responses={200: AdminCompanyUpdateRequestSerializer},
    )
    @action(detail=True, methods=['post'], url_path='start-review')
    def start_review(self, request, public_id=None):
        serializer = AdminCompanyUpdateStartReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            update_request = start_company_update_review(
                self.get_object(),
                actor=request.user,
                lock_version=values['lock_version'],
                revision_public_id=values.get('revision_public_id', ''),
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        current = self.get_queryset().get(pk=update_request.pk)
        return Response(self.get_serializer(current).data)

    @extend_schema(
        summary='Ra quyết định cuối cho yêu cầu cập nhật công ty',
        request=AdminCompanyUpdateReviewSerializer,
        responses={200: AdminCompanyUpdateRequestSerializer},
    )
    @action(detail=True, methods=['post'])
    def review(self, request, public_id=None):
        serializer = AdminCompanyUpdateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        update_request = self.get_object()
        if update_request.status != CompanyUpdateRequest.Status.IN_REVIEW:
            raise ValidationError(
                {'detail': 'Phải nhận thẩm định yêu cầu trước khi ra quyết định.'}
            )
        try:
            update_request = apply_update_request(
                update_request,
                request.user,
                decision=values['decision'],
                note=values.get('note', ''),
                lock_version=values['lock_version'],
                revision_public_id=values.get('revision_public_id', ''),
            )
        except StaleImpactToken as error:
            raise AdminResourceChanged() from error
        except CompanyUpdateConflict as error:
            raise CompanyUpdateConflictResponse(error.fields) from error
        current = self.get_queryset().get(pk=update_request.pk)
        return Response(self.get_serializer(current).data)

    @extend_schema(
        summary='Tra cứu lại mã số thuế của yêu cầu cập nhật công ty',
        request=None,
        responses={200: AdminCompanyUpdateRequestSerializer},
    )
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

    @extend_schema(
        summary='Xem giấy tờ của yêu cầu cập nhật công ty (ghi nhật ký truy cập)',
        parameters=[DOCUMENT_PUBLIC_ID_PARAMETER],
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
        return private_document_response(document, render_preview=True)
