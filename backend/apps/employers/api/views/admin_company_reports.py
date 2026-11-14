"""Administrator queue of company page reports."""

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasAdminPermission, require_admin_permission
from common.pagination import StandardPagination

from ...selectors import admin_company_reports_queryset
from ...services import resolve_company_report, reverse_company_report
from ..serializers import (
    AdminCompanyReportQuerySerializer,
    AdminCompanyReportResolveSerializer,
    AdminCompanyReportReverseSerializer,
    AdminCompanyReportSerializer,
)

RESOLVE_PERMISSIONS = ['company_report.view', 'company_report.resolve']


class AdminCompanyReportViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    serializer_class = AdminCompanyReportSerializer
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['company_report.view'],
        'resolve': RESOLVE_PERMISSIONS,
        'reverse': RESOLVE_PERMISSIONS,
    }

    def get_queryset(self):
        if self.action != 'list':
            return admin_company_reports_queryset()
        query = AdminCompanyReportQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return admin_company_reports_queryset(params=query.validated_data)

    def _reloaded_row(self):
        # Reload: the decision adds a history event and may flip the page hold.
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, public_id=None):
        serializer = AdminCompanyReportResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data['apply_hold']:
            # Resolving a report must not become a way around the permission
            # that guards hiding a public page.
            require_admin_permission(request.user, 'company_page.moderate')
        resolve_company_report(
            report=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return self._reloaded_row()

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
