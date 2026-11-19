"""Administrator queue of company page reports."""

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import admin_company_reports_queryset
from ...services import resolve_company_report, reverse_company_report
from ..serializers import (
    AdminCompanyReportQuerySerializer,
    AdminCompanyReportResolveSerializer,
    AdminCompanyReportReverseSerializer,
    AdminCompanyReportSerializer,
)


@extend_schema_view(
    list=extend_schema(
        summary='Hàng đợi báo cáo trang công ty',
        parameters=[AdminCompanyReportQuerySerializer],
    )
)
class AdminCompanyReportViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminCompanyReportSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        if self.action != 'list':
            return admin_company_reports_queryset()
        query = AdminCompanyReportQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return admin_company_reports_queryset(params=query.validated_data)

    def _reloaded_row(self):
        # Reload: the decision adds a history event and may flip the page hold.
        return Response(self.get_serializer(self.get_object()).data)

    @extend_schema(
        summary='Kết luận một báo cáo trang công ty',
        request=AdminCompanyReportResolveSerializer,
        responses={200: AdminCompanyReportSerializer},
    )
    @action(detail=True, methods=['post'])
    def resolve(self, request, public_id=None):
        serializer = AdminCompanyReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resolve_company_report(
            report=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return self._reloaded_row()

    @extend_schema(
        summary='Đảo ngược kết luận báo cáo trang công ty',
        request=AdminCompanyReportReverseSerializer,
        responses={200: AdminCompanyReportSerializer},
    )
    @action(detail=True, methods=['post'])
    def reverse(self, request, public_id=None):
        serializer = AdminCompanyReportReverseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reverse_company_report(
            report=self.get_object(),
            actor=request.user,
            note=serializer.validated_data['note'],
        )
        return self._reloaded_row()
