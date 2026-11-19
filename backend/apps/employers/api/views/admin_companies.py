from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission
from common.api.pagination import StandardPagination

from ...selectors import (
    admin_companies_queryset,
    admin_company_detail_queryset,
    admin_company_recruiters_queryset,
    admin_company_summary,
    build_public_company_profile,
    company_page_policy_hold,
    company_page_queryset,
)
from ...services import admin_assign_company_owner, set_company_page_policy_hold
from ..serializers import (
    AdminCompanyDetailSerializer,
    AdminCompanyListSerializer,
    AdminCompanyPolicyHoldSerializer,
    AdminCompanyRecruiterSerializer,
)

PUBLIC_PAGE_ACTIONS = {'public_page', 'policy_hold'}


def _public_page_payload(company, request):
    return {
        'public_path': company.public_page_path,
        'is_indexable': company.is_indexable,
        'policy_hold': company_page_policy_hold(company),
        # Built even while on hold: moderators review exactly what was hidden.
        'profile': build_public_company_profile(company, request=request),
    }


class AdminCompanyViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AdminPortalPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'

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
            'can_view_sensitive': True,
            'can_view_account_sensitive': True,
            'can_view_verification': True,
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

    @action(detail=True, methods=['post'], url_path='assign-owner')
    def assign_owner(self, request, public_id=None):
        company = self.get_object()
        target = admin_assign_company_owner(
            request.user,
            company,
            request.data.get('recruiter', ''),
            reason=request.data.get('reason', ''),
        )
        row = admin_company_recruiters_queryset(company).get(pk=target.pk)
        return Response(
            AdminCompanyRecruiterSerializer(row, context=self.get_serializer_context()).data
        )

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
