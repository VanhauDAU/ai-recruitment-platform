from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.exceptions import AdminPermissionDenied
from apps.accounts.permissions import HasAdminPermission, require_admin_permission
from common.pagination import StandardPagination

from ...selectors import (
    admin_companies_queryset,
    admin_company_detail_queryset,
    admin_company_recruiters_queryset,
)
from ..serializers import (
    AdminCompanyDetailSerializer,
    AdminCompanyListSerializer,
    AdminCompanyRecruiterSerializer,
)


def _has_permission(user, code):
    try:
        require_admin_permission(user, code)
    except AdminPermissionDenied:
        return False
    return True


class AdminCompanyViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['company.view'],
        'retrieve': ['company.view'],
        'recruiters': ['company.view', 'company_recruiter.view'],
    }

    def get_queryset(self):
        if self.action == 'list':
            return admin_companies_queryset(params=self.request.query_params)
        return admin_company_detail_queryset()

    def get_serializer_class(self):
        if self.action == 'list':
            return AdminCompanyListSerializer
        return AdminCompanyDetailSerializer

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            'can_view_sensitive': _has_permission(
                self.request.user,
                'company.sensitive.view',
            ),
            'can_view_account_sensitive': _has_permission(
                self.request.user,
                'account.sensitive.view',
            ),
            'can_view_verification': _has_permission(
                self.request.user,
                'employer_verification.view',
            ),
        }

    @action(detail=True, methods=['get'])
    def recruiters(self, request, public_id=None):
        company = self.get_object()
        queryset = admin_company_recruiters_queryset(
            company,
            params=request.query_params,
        )
        page = self.paginate_queryset(queryset)
        serializer = AdminCompanyRecruiterSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)
