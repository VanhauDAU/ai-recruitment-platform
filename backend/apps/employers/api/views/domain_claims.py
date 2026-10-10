from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.throttling import ClientIPScopedRateThrottle, SuffixedScopedRateThrottleMixin

from ...selectors import company_domain_claims_queryset
from ...services import (
    DomainClaimError,
    create_domain_claim,
    get_or_create_recruiter,
    request_manual_domain_review,
    rotate_domain_claim,
    verify_domain_claim,
)
from ..serializers import (
    CompanyDomainClaimManualRequestSerializer,
    CompanyDomainClaimRotateSerializer,
    CompanyDomainClaimSerializer,
)


def _domain_error_response(error):
    if error.code == 'not_found':
        raise NotFound(error.detail)
    response_status = (
        status.HTTP_409_CONFLICT
        if error.code in {'resource_changed', 'domain_owned_by_another_company'}
        else status.HTTP_400_BAD_REQUEST
    )
    return Response({'code': error.code, 'detail': error.detail}, status=response_status)


def _recruiter(user):
    return get_or_create_recruiter(user)


class _DomainClaimAccountThrottle(SuffixedScopedRateThrottleMixin, ScopedRateThrottle):
    scope_suffix = 'account'


class _DomainClaimIPThrottle(SuffixedScopedRateThrottleMixin, ClientIPScopedRateThrottle):
    scope_suffix = 'ip'


class _DomainClaimThrottledView(APIView):
    permission_classes = [IsEmployer]

    def get_throttles(self):
        # Apply independent account and trusted-client-IP buckets. The custom
        # IP throttle overrides DRF's authenticated-user key selection.
        self.throttle_classes = [_DomainClaimAccountThrottle, _DomainClaimIPThrottle]
        return super().get_throttles()


class CompanyDomainClaimListCreateView(_DomainClaimThrottledView):
    def get_throttles(self):
        if self.request.method == 'GET':
            return []
        self.throttle_scope = 'employer_domain_claim_issue'
        return super().get_throttles()

    @extend_schema(
        summary='Danh sách tên miền công ty của nhà tuyển dụng hiện tại',
        responses={200: CompanyDomainClaimSerializer(many=True)},
        tags=['employer-domain-verification'],
    )
    def get(self, request):
        recruiter = _recruiter(request.user)
        if recruiter.company_id is None:
            raise NotFound('Bạn chưa liên kết với công ty nào.')
        claims = company_domain_claims_queryset(company=recruiter.company)
        return Response(CompanyDomainClaimSerializer(claims, many=True).data)

    @extend_schema(
        summary='Tạo DNS TXT challenge từ domain email đã xác thực',
        request=None,
        responses={201: CompanyDomainClaimSerializer},
        tags=['employer-domain-verification'],
    )
    def post(self, request):
        try:
            claim, txt_value = create_domain_claim(recruiter=_recruiter(request.user))
        except DomainClaimError as error:
            return _domain_error_response(error)
        return Response(
            CompanyDomainClaimSerializer(claim, context={'txt_value': txt_value}).data,
            status=status.HTTP_201_CREATED,
        )


class CompanyDomainClaimVerifyView(_DomainClaimThrottledView):
    throttle_scope = 'employer_domain_claim_verify'

    @extend_schema(
        summary='Kiểm tra DNS TXT challenge',
        request=None,
        responses={200: CompanyDomainClaimSerializer},
        tags=['employer-domain-verification'],
    )
    def post(self, request, public_id):
        try:
            claim = verify_domain_claim(
                claim_public_id=public_id,
                recruiter=_recruiter(request.user),
            )
        except DomainClaimError as error:
            return _domain_error_response(error)
        return Response(CompanyDomainClaimSerializer(claim).data)


class CompanyDomainClaimRotateView(_DomainClaimThrottledView):
    throttle_scope = 'employer_domain_claim_issue'

    @extend_schema(
        summary='Vô hiệu challenge cũ và tạo DNS TXT challenge mới',
        request=CompanyDomainClaimRotateSerializer,
        responses={200: CompanyDomainClaimSerializer},
        tags=['employer-domain-verification'],
    )
    def post(self, request, public_id):
        serializer = CompanyDomainClaimRotateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            claim, txt_value = rotate_domain_claim(
                claim_public_id=public_id,
                recruiter=_recruiter(request.user),
                lock_version=serializer.validated_data['lock_version'],
            )
        except DomainClaimError as error:
            return _domain_error_response(error)
        return Response(CompanyDomainClaimSerializer(claim, context={'txt_value': txt_value}).data)


class CompanyDomainClaimManualReviewView(_DomainClaimThrottledView):
    throttle_scope = 'employer_domain_claim_manual'

    @extend_schema(
        summary='Yêu cầu quản trị duyệt tên miền thủ công',
        request=CompanyDomainClaimManualRequestSerializer,
        responses={200: CompanyDomainClaimSerializer},
        tags=['employer-domain-verification'],
    )
    def post(self, request, public_id):
        serializer = CompanyDomainClaimManualRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            claim = request_manual_domain_review(
                claim_public_id=public_id,
                recruiter=_recruiter(request.user),
                **serializer.validated_data,
            )
        except DomainClaimError as error:
            return _domain_error_response(error)
        return Response(CompanyDomainClaimSerializer(claim).data)
