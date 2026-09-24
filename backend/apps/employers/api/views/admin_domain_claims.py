from django.db.models import Count, Min, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.admin_access_rules import InvalidImpactToken, StaleImpactToken
from apps.accounts.permissions import HasAdminPermission
from common.pagination import StandardPagination

from ...models import CompanyDomainClaim
from ...selectors import admin_domain_claims_queryset
from ...services import (
    DomainClaimError,
    confirm_domain_claim_admin_action,
    domain_claim_admin_impact,
)
from ..serializers import (
    AdminCompanyDomainClaimDetailSerializer,
    AdminCompanyDomainClaimSerializer,
    AdminCompanyDomainClaimSummarySerializer,
    AdminDomainClaimConfirmationSerializer,
    AdminDomainClaimImpactResponseSerializer,
    AdminDomainClaimImpactSerializer,
)


def _admin_error_response(error):
    if isinstance(error, StaleImpactToken):
        return Response(
            {'code': 'admin_resource_changed', 'detail': str(error)},
            status=status.HTTP_409_CONFLICT,
        )
    if isinstance(error, InvalidImpactToken):
        return Response(
            {'code': 'invalid_impact_token', 'detail': str(error)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    response_status = (
        status.HTTP_409_CONFLICT
        if error.code in {'resource_changed', 'domain_owned_by_another_company'}
        else status.HTTP_400_BAD_REQUEST
    )
    return Response({'code': error.code, 'detail': error.detail}, status=response_status)


class AdminCompanyDomainClaimViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    serializer_class = AdminCompanyDomainClaimSerializer
    required_admin_permissions = {
        'list': ['employer_domain.view'],
        'retrieve': ['employer_domain.view'],
        'summary': ['employer_domain.view'],
        'manual_review_impact': ['employer_domain.review'],
        'approve_manual': ['employer_domain.review'],
        'reject_manual': ['employer_domain.review'],
        'revoke_impact': ['employer_domain.revoke'],
        'revoke': ['employer_domain.revoke'],
    }

    def get_queryset(self):
        queryset = admin_domain_claims_queryset(params=self.request.query_params)
        if self.action == 'retrieve':
            return queryset.prefetch_related('events__actor')
        return queryset

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AdminCompanyDomainClaimDetailSerializer
        return super().get_serializer_class()

    @extend_schema(
        parameters=[
            OpenApiParameter('status', str, enum=CompanyDomainClaim.Status.values),
            OpenApiParameter('method', str, enum=CompanyDomainClaim.Method.values),
            OpenApiParameter('search', str),
        ],
        responses={200: AdminCompanyDomainClaimSerializer(many=True)},
        tags=['admin-employer-domain-verification'],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    @extend_schema(
        responses={200: AdminCompanyDomainClaimSummarySerializer},
        tags=['admin-employer-domain-verification'],
    )
    def summary(self, request):
        attention_statuses = [
            CompanyDomainClaim.Status.REJECTED,
            CompanyDomainClaim.Status.REVOKED,
            CompanyDomainClaim.Status.EXPIRED,
            CompanyDomainClaim.Status.LEGACY_INFERRED,
        ]
        data = CompanyDomainClaim.objects.aggregate(
            total=Count('id'),
            manual_pending=Count(
                'id',
                filter=Q(
                    status=CompanyDomainClaim.Status.PENDING,
                    method=CompanyDomainClaim.Method.ADMIN_MANUAL,
                    manual_review_requested_at__isnull=False,
                ),
            ),
            dns_pending=Count(
                'id',
                filter=Q(
                    status=CompanyDomainClaim.Status.PENDING,
                    method=CompanyDomainClaim.Method.DNS_TXT,
                ),
            ),
            verified=Count('id', filter=Q(status=CompanyDomainClaim.Status.VERIFIED)),
            grace=Count('id', filter=Q(status=CompanyDomainClaim.Status.GRACE)),
            needs_attention=Count('id', filter=Q(status__in=attention_statuses)),
            oldest_manual_pending_at=Min(
                'manual_review_requested_at',
                filter=Q(
                    status=CompanyDomainClaim.Status.PENDING,
                    method=CompanyDomainClaim.Method.ADMIN_MANUAL,
                ),
            ),
        )
        return Response(AdminCompanyDomainClaimSummarySerializer(data).data)

    def _impact(self, request, *, action_name):
        serializer = AdminDomainClaimImpactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = domain_claim_admin_impact(
                self.get_object(),
                actor=request.user,
                action=action_name,
                reason=serializer.validated_data['reason'],
            )
        except DomainClaimError as error:
            return _admin_error_response(error)
        return Response(result)

    def _confirm(self, request, *, action_name):
        serializer = AdminDomainClaimConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            claim = confirm_domain_claim_admin_action(
                self.get_object(),
                actor=request.user,
                action=action_name,
                **serializer.validated_data,
            )
        except (DomainClaimError, InvalidImpactToken, StaleImpactToken) as error:
            return _admin_error_response(error)
        return Response(self.get_serializer(claim).data)

    @action(detail=True, methods=['post'], url_path='manual-review-impact')
    @extend_schema(
        request=AdminDomainClaimImpactSerializer,
        responses={200: AdminDomainClaimImpactResponseSerializer},
        tags=['admin-employer-domain-verification'],
    )
    def manual_review_impact(self, request, public_id=None):
        action_name = request.data.get('decision', 'approve_manual')
        if action_name not in {'approve_manual', 'reject_manual'}:
            return Response(
                {'decision': ['Quyết định phải là approve_manual hoặc reject_manual.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return self._impact(request, action_name=action_name)

    @action(detail=True, methods=['post'], url_path='approve-manual')
    @extend_schema(
        request=AdminDomainClaimConfirmationSerializer,
        responses={200: AdminCompanyDomainClaimSerializer},
        tags=['admin-employer-domain-verification'],
    )
    def approve_manual(self, request, public_id=None):
        return self._confirm(request, action_name='approve_manual')

    @action(detail=True, methods=['post'], url_path='reject-manual')
    @extend_schema(
        request=AdminDomainClaimConfirmationSerializer,
        responses={200: AdminCompanyDomainClaimSerializer},
        tags=['admin-employer-domain-verification'],
    )
    def reject_manual(self, request, public_id=None):
        return self._confirm(request, action_name='reject_manual')

    @action(detail=True, methods=['post'], url_path='revoke-impact')
    @extend_schema(
        request=AdminDomainClaimImpactSerializer,
        responses={200: AdminDomainClaimImpactResponseSerializer},
        tags=['admin-employer-domain-verification'],
    )
    def revoke_impact(self, request, public_id=None):
        return self._impact(request, action_name='revoke')

    @action(detail=True, methods=['post'])
    @extend_schema(
        request=AdminDomainClaimConfirmationSerializer,
        responses={200: AdminCompanyDomainClaimSerializer},
        tags=['admin-employer-domain-verification'],
    )
    def revoke(self, request, public_id=None):
        return self._confirm(request, action_name='revoke')
