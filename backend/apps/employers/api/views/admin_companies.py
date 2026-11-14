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
    admin_company_summary,
    build_public_company_profile,
    company_page_policy_hold,
    company_page_queryset,
)
from ...services import set_company_page_policy_hold
from ..serializers import (
    AdminCompanyDetailSerializer,
    AdminCompanyListSerializer,
    AdminCompanyPolicyHoldSerializer,
    AdminCompanyRecruiterSerializer,
)

PUBLIC_PAGE_ACTIONS = {'public_page', 'policy_hold'}


def _has_permission(user, code):
    try:
        require_admin_permission(user, code)
    except AdminPermissionDenied:
        return False
    return True


def _public_page_payload(company, request):
    return {
        'public_path': company.public_page_path,
        'is_indexable': company.is_indexable,
        'policy_hold': company_page_policy_hold(company),
        # Built even while on hold: moderators review exactly what was hidden.
        'profile': build_public_company_profile(company, request=request),
    }


class AdminCompanyViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['company.view'],
        'summary': ['company.view'],
        'retrieve': ['company.view'],
        'recruiters': ['company.view', 'company_recruiter.view'],
        'public_page': ['company.view'],
        'policy_hold': ['company.view', 'company_page.moderate'],
    }

    def get_queryset(self):
        if self.action == 'list':
            return admin_companies_queryset(params=self.request.query_params)
        if self.action in PUBLIC_PAGE_ACTIONS:
            return company_page_queryset()
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

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(admin_company_summary())

    @action(detail=True, methods=['get'], url_path='public-page')
    def public_page(self, request, public_id=None):
        return Response(_public_page_payload(self.get_object(), request))

    @action(detail=True, methods=['post'], url_path='policy-hold')
    def policy_hold(self, request, public_id=None):
        serializer = AdminCompanyPolicyHoldSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_company_page_policy_hold(
            self.get_object(),
            actor=request.user,
            hold=serializer.validated_data['action'] == 'apply',
            reason=serializer.validated_data['reason'],
        )
        # Reload: the hold flips both the flag and the indexability annotation.
        return Response(_public_page_payload(self.get_object(), request))
