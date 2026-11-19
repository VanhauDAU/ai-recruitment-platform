from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission
from common.api.pagination import StandardPagination

from ...selectors import admin_company_join_requests_queryset
from ...services import decide_company_join
from ..serializers.join_requests import AdminCompanyJoinRequestSerializer


class AdminCompanyJoinRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Join requests across companies; administrators decide only those without an owner."""

    permission_classes = [AdminPortalPermission]
    pagination_class = StandardPagination
    serializer_class = AdminCompanyJoinRequestSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_company_join_requests_queryset(params=self.request.query_params)

    @action(detail=True, methods=['post'], url_path=r'(?P<decision>approve|reject)')
    def decide(self, request, public_id=None, decision=None):
        if decision not in {'approve', 'reject'}:
            raise ValidationError({'decision': 'Chỉ chấp nhận approve hoặc reject.'})
        join_request = decide_company_join(request.user, public_id, approve=decision == 'approve')
        return Response(AdminCompanyJoinRequestSerializer(join_request).data)
