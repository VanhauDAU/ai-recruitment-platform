"""Read-only sub-collections shown on the admin account detail page."""

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from ...selectors import (
    account_activity_queryset,
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
    AccountActivitySerializer,
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
        responses={200: AccountActivitySerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def activity(self, request, public_id=None):
        queryset = account_activity_queryset(self.get_object())
        page = self.paginate_queryset(queryset)
        serializer = AccountActivitySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
