from django.utils.translation import gettext as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, parsers, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from common.api.throttling import WriteScopedRateThrottle, with_default_throttles

from ...selectors import (
    company_join_requests_for_owner,
    company_members_queryset,
    former_company_members_queryset,
    pending_company_join_request,
)
from ...services import (
    CompanyUnlinkError,
    cancel_company_join,
    decide_company_join,
    hand_over_recruiter_resources,
    remove_company_member,
    request_company_join,
    transfer_company_ownership,
)
from ..permissions import caller_can_decide_join_requests, require_company_manager
from ..serializers.company_members import (
    CompanyMemberSerializer,
    FormerCompanyMemberSerializer,
)
from ..serializers.join_requests import CompanyJoinRequestSerializer


class JoinCompanyView(APIView):
    """Xin tham gia một công ty có sẵn; chỉ có hiệu lực khi chủ công ty duyệt.

    Đây chỉ là gán HR vào công ty, không phải yêu cầu xác thực hay yêu cầu
    chỉnh sửa công ty. Hai nghiệp vụ sau có workflow duyệt riêng.
    """

    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'company_join'
    permission_classes = [IsEmployer]
    parser_classes = [parsers.MultiPartParser, parsers.JSONParser]

    @extend_schema(
        summary='Gửi yêu cầu tham gia công ty có sẵn',
        request=inline_serializer(
            'JoinCompany',
            fields={
                'company': serializers.CharField(help_text='public_id công ty'),
            },
        ),
        responses={202: CompanyJoinRequestSerializer},
        tags=['employer'],
    )
    def post(self, request):
        legacy_proof_fields = {
            'proof_type',
            'business_registration_file',
            'authorization_file',
            'identity_file',
        }
        if legacy_proof_fields.intersection(request.data) or legacy_proof_fields.intersection(
            request.FILES
        ):
            raise ValidationError(
                {
                    'detail': _(
                        'Tham gia công ty không yêu cầu hoặc nhận giấy tờ chứng minh. '
                        'Giấy tờ chỉ được nộp khi xác thực hoặc yêu cầu cập nhật công ty.'
                    )
                }
            )
        join_request = request_company_join(request.user, request.data.get('company'))
        return Response(
            CompanyJoinRequestSerializer(join_request).data, status=status.HTTP_202_ACCEPTED
        )


class MyCompanyJoinRequestView(APIView):
    """The caller's pending request: read it, or cancel it to pick another company."""

    permission_classes = [IsEmployer]

    @extend_schema(
        responses={200: CompanyJoinRequestSerializer(allow_null=True)}, tags=['employer']
    )
    def get(self, request):
        pending = pending_company_join_request(request.user)
        return Response(CompanyJoinRequestSerializer(pending).data if pending else None)

    @extend_schema(responses={204: None}, tags=['employer'])
    def delete(self, request):
        cancel_company_join(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    get=extend_schema(
        summary='Yêu cầu tham gia đang chờ của công ty tôi quản lý',
        responses={200: CompanyJoinRequestSerializer(many=True)},
        tags=['employer'],
    )
)
class CompanyJoinRequestListView(generics.ListAPIView):
    """Pending requests to the company the caller owns."""

    permission_classes = [IsEmployer]
    serializer_class = CompanyJoinRequestSerializer
    pagination_class = None

    def get_queryset(self):
        return company_join_requests_for_owner(self.request.user)

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            'can_decide': caller_can_decide_join_requests(self.request.user),
        }


class CompanyJoinRequestDecisionView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(request=None, responses={200: CompanyJoinRequestSerializer}, tags=['employer'])
    def post(self, request, public_id, decision):
        if decision not in {'approve', 'reject'}:
            raise ValidationError({'decision': _('Chỉ chấp nhận approve hoặc reject.')})
        join_request = decide_company_join(request.user, public_id, approve=decision == 'approve')
        return Response(CompanyJoinRequestSerializer(join_request).data)


class CompanyOwnershipTransferView(APIView):
    """The verified owner hands the company to a verified member."""

    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Chuyển quyền owner công ty cho thành viên đã xác thực',
        request=inline_serializer(
            'CompanyOwnershipTransfer',
            fields={'recruiter': serializers.CharField(help_text='member_id của thành viên')},
        ),
        responses={204: None},
        tags=['employer'],
    )
    def post(self, request):
        transfer_company_ownership(request.user, request.data.get('recruiter', ''))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    get=extend_schema(
        summary='Thành viên công ty và thao tác quản lý được phép',
        responses={200: CompanyMemberSerializer(many=True)},
        tags=['employer'],
    )
)
class CompanyMemberListView(generics.ListAPIView):
    """Members with their verification, activity and what the manager may do."""

    permission_classes = [IsEmployer]
    serializer_class = CompanyMemberSerializer
    pagination_class = None

    def get_queryset(self):
        return company_members_queryset(require_company_manager(self.request.user))


class CompanyMemberRemoveView(APIView):
    """The manager removes a member who has nothing left running for the company."""

    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Gỡ thành viên khỏi công ty',
        request=inline_serializer(
            'CompanyMemberRemove', fields={'reason': serializers.CharField()}
        ),
        responses={204: None},
        tags=['employer'],
    )
    def post(self, request, member_id):
        try:
            remove_company_member(request.user, member_id, reason=request.data.get('reason', ''))
        except CompanyUnlinkError as error:
            raise ValidationError(
                {'code': error.code, 'detail': error.message, 'blockers': list(error.blockers)}
            ) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    get=extend_schema(
        summary='Người đã rời công ty còn giữ tin tuyển dụng chờ bàn giao',
        responses={200: FormerCompanyMemberSerializer(many=True)},
        tags=['employer'],
    )
)
class FormerCompanyMemberListView(generics.ListAPIView):
    """People who left but still hold jobs here, waiting to be handed over."""

    permission_classes = [IsEmployer]
    serializer_class = FormerCompanyMemberSerializer
    pagination_class = None

    def get_queryset(self):
        return former_company_members_queryset(require_company_manager(self.request.user))


class CompanyHandoverView(APIView):
    """The manager gives one person's jobs and campaigns to a verified member."""

    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Giao tin tuyển dụng và chiến dịch của một người cho thành viên khác',
        request=inline_serializer(
            'CompanyHandover',
            fields={
                'source': serializers.CharField(help_text='member_id của người đang giữ tin'),
                'target': serializers.CharField(help_text='member_id của người nhận'),
            },
        ),
        responses={200: OpenApiTypes.OBJECT},
        tags=['employer'],
    )
    def post(self, request):
        result = hand_over_recruiter_resources(
            request.user,
            source_id=request.data.get('source', ''),
            target_id=request.data.get('target', ''),
        )
        return Response(result)
