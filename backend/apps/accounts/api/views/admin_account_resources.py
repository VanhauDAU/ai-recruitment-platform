"""Read-only sub-collections shown on the admin account detail page."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from ...domain import account_activity as activity_rules
from ...selectors import (
    account_activity_counts,
    account_activity_timeline,
    account_applications_queryset,
    account_campaigns_queryset,
    account_consents_queryset,
    account_cvs_queryset,
    account_jobs_queryset,
    account_recruitment_needs_queryset,
    account_sessions_queryset,
)
from ..serializers.admin_account_resources import (
    AdminApplicationSerializer,
    AdminCampaignSerializer,
    AdminCandidateConsentSerializer,
    AdminCvSerializer,
    AdminJobSerializer,
    AdminRecruitmentNeedSerializer,
)
from ..serializers.managed_accounts import (
    AccountActivityPageSerializer,
    ManagedSessionSerializer,
)


class AccountResourceActionsMixin:
    """Paginated per-account resources; relies on the host viewset's ``_paginated``."""

    @extend_schema(summary='CV của tài khoản', responses={200: AdminCvSerializer(many=True)})
    @action(detail=True, methods=['get'])
    def cvs(self, request, public_id=None):
        return self._paginated(account_cvs_queryset(self.get_object()), AdminCvSerializer)

    @extend_schema(
        summary='Hồ sơ ứng tuyển của tài khoản',
        responses={200: AdminApplicationSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def applications(self, request, public_id=None):
        return self._paginated(
            account_applications_queryset(self.get_object()), AdminApplicationSerializer
        )

    @extend_schema(
        summary='Đồng ý dữ liệu của ứng viên',
        responses={200: AdminCandidateConsentSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def consents(self, request, public_id=None):
        return self._paginated(
            account_consents_queryset(self.get_object()), AdminCandidateConsentSerializer
        )

    @extend_schema(
        summary='Nhu cầu tuyển dụng của NTD',
        responses={200: AdminRecruitmentNeedSerializer(many=True)},
    )
    @action(detail=True, methods=['get'], url_path='recruitment-needs')
    def recruitment_needs(self, request, public_id=None):
        return self._paginated(
            account_recruitment_needs_queryset(self.get_object()), AdminRecruitmentNeedSerializer
        )

    @extend_schema(summary='Tin tuyển dụng của NTD', responses={200: AdminJobSerializer(many=True)})
    @action(detail=True, methods=['get'])
    def jobs(self, request, public_id=None):
        return self._paginated(account_jobs_queryset(self.get_object()), AdminJobSerializer)

    @extend_schema(
        summary='Chiến dịch tuyển dụng của NTD',
        responses={200: AdminCampaignSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def campaigns(self, request, public_id=None):
        return self._paginated(
            account_campaigns_queryset(self.get_object()), AdminCampaignSerializer
        )

    @extend_schema(
        summary='Phiên đăng nhập của tài khoản',
        responses={200: ManagedSessionSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def sessions(self, request, public_id=None):
        return Response(
            ManagedSessionSerializer(
                account_sessions_queryset(self.get_object()),
                many=True,
            ).data
        )

    @extend_schema(
        summary='Nhật ký hoạt động của tài khoản',
        description=(
            'Gộp đăng nhập, thao tác quản trị, đổi trạng thái, xác thực, công ty và tuyển '
            'dụng; mới nhất trước, phân trang bằng con trỏ `before`. `category_counts` '
            'chỉ có ở trang đầu.'
        ),
        parameters=[
            OpenApiParameter('category', str, enum=list(activity_rules.CATEGORIES)),
            OpenApiParameter('before', str, description='`next_cursor` của trang trước.'),
            OpenApiParameter('limit', int, description='Mặc định 30, tối đa 100.'),
        ],
        responses={200: AccountActivityPageSerializer},
    )
    @action(detail=True, methods=['get'])
    def activity(self, request, public_id=None):
        user = self.get_object()
        cursor = activity_rules.decode_cursor(request.query_params.get('before'))
        payload = account_activity_timeline(
            user,
            category=activity_rules.parse_category(request.query_params.get('category')),
            cursor=cursor,
            limit=activity_rules.parse_limit(request.query_params.get('limit')),
        )
        if cursor is None:
            payload['category_counts'] = account_activity_counts(user)
        return Response(payload)
