"""Recruiter side of company update requests: submit, list, withdraw or cancel before review."""

from django.http import Http404
from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import IsEmployer
from common.api.throttling import WriteScopedRateThrottle, with_default_throttles

from ...models import CompanyUpdateRequest
from ...models.page_access import resolve_company_page_access
from ...selectors import company_update_request_for_company, company_update_requests_queryset
from ...services import (
    CompanyUpdateConflict,
    CompanyUpdateInReview,
    close_company_update_before_review,
    submit_validated_company_update,
)
from ..exceptions import CompanyUpdateConflictResponse, company_update_in_review
from ..permissions import require_company_recruiter
from ..serializers import CompanyUpdateRequestCloseSerializer, CompanyUpdateRequestSerializer


class CompanyUpdateRequestListCreateView(generics.ListCreateAPIView):
    """Yêu cầu cập nhật công ty.

    Mỗi requester có tối đa một yêu cầu pending trên một công ty. POST tiếp theo
    của cùng requester cập nhật chính record đó; request của thành viên khác
    luôn độc lập.
    """

    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'company_update_request'
    serializer_class = CompanyUpdateRequestSerializer
    permission_classes = [IsEmployer]
    pagination_class = None

    def get_recruiter(self):
        if not hasattr(self, '_recruiter'):
            self._recruiter = require_company_recruiter(self.request.user)
        return self._recruiter

    @extend_schema(
        summary='Lịch sử yêu cầu cập nhật công ty',
        responses={200: CompanyUpdateRequestSerializer(many=True)},
        tags=['employer'],
        parameters=[
            OpenApiParameter(
                'scope',
                OpenApiTypes.STR,
                OpenApiParameter.QUERY,
                enum=['mine', 'company'],
                description='mine: yêu cầu của tôi; company: lịch sử toàn công ty (mặc định).',
            )
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        scope = self.request.query_params.get('scope', 'company')
        if scope not in {'mine', 'company'}:
            raise ValidationError({'scope': _('Phạm vi phải là mine hoặc company.')})
        return company_update_requests_queryset(
            company=self.get_recruiter().company,
            requester=self.request.user if scope == 'mine' else None,
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['company'] = self.get_recruiter().company
        context['recruiter'] = self.get_recruiter()
        return context

    @extend_schema(
        summary='Gửi hoặc sửa yêu cầu cập nhật công ty đang mở của tôi',
        request=CompanyUpdateRequestSerializer,
        responses={201: CompanyUpdateRequestSerializer, 200: CompanyUpdateRequestSerializer},
        tags=['employer'],
    )
    def post(self, request, *args, **kwargs):
        recruiter = self.get_recruiter()

        def validate(company, active_request):
            serializer = self.get_serializer(
                active_request,
                data=request.data,
                # Page content fields need the page policy (ER-D59).
                context={
                    **self.get_serializer_context(),
                    'page_access': resolve_company_page_access(recruiter),
                },
            )
            serializer.is_valid(raise_exception=True)
            return serializer.validated_data

        try:
            update_request, created = submit_validated_company_update(
                company_id=recruiter.company_id,
                requester=request.user,
                validate=validate,
            )
        except CompanyUpdateInReview as error:
            raise ValidationError(company_update_in_review()) from error
        except CompanyUpdateConflict as error:
            raise CompanyUpdateConflictResponse(error.fields) from error
        return Response(
            self.get_serializer(update_request).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CompanyUpdateRequestLifecycleView(generics.GenericAPIView):
    permission_classes = [IsEmployer]
    serializer_class = CompanyUpdateRequestCloseSerializer

    @extend_schema(
        operation_id='employer_company_update_request_lifecycle',
        summary='Rút hoặc hủy yêu cầu cập nhật công ty trước khi thẩm định',
        request=CompanyUpdateRequestCloseSerializer,
        responses={200: CompanyUpdateRequestSerializer},
    )
    def post(self, request, public_id, action):
        recruiter = require_company_recruiter(request.user)
        update_request = company_update_request_for_company(
            company=recruiter.company,
            public_id=public_id,
        )
        if update_request is None:
            raise Http404
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_status = {
            'withdraw': CompanyUpdateRequest.Status.WITHDRAWN,
            'cancel': CompanyUpdateRequest.Status.CANCELLED,
        }.get(action)
        if action_status is None:
            raise Http404
        try:
            update_request = close_company_update_before_review(
                update_request,
                actor=request.user,
                action=action_status,
                reason=serializer.validated_data.get('reason', ''),
                lock_version=serializer.validated_data['lock_version'],
                actor_is_owner=(recruiter.company_role == recruiter.CompanyRole.OWNER),
            )
        except CompanyUpdateConflict as error:
            raise CompanyUpdateConflictResponse(error.fields) from error
        return Response(
            CompanyUpdateRequestSerializer(
                update_request,
                context={
                    **self.get_serializer_context(),
                    'company': recruiter.company,
                    'recruiter': recruiter,
                },
            ).data
        )
