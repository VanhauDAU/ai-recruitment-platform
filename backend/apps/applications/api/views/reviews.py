"""Review links: recruiter management and the public reviewer page."""

from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.employers.services import ensure_recruiter_candidate_data_access
from common.throttling import ClientIPScopedRateThrottle

from ...selectors import (
    employer_application_queryset,
    recruiter_review_links_queryset,
    recruiter_reviews_queryset,
)
from ...services import (
    ReviewLinkUnavailable,
    ReviewNotShareable,
    create_review_link,
    open_review_link,
    revoke_review_link,
    submit_review,
)
from ..serializers.reviews import (
    ApplicationReviewSerializer,
    ReviewLinkCreateSerializer,
    ReviewLinkSerializer,
    ReviewSubmitSerializer,
    review_page_url,
    review_summary,
    reviewer_payload,
)


def _application(request, public_id):
    ensure_recruiter_candidate_data_access(request.user)
    return get_object_or_404(employer_application_queryset(request.user), public_id=public_id)


@extend_schema(tags=['applications-v2'])
class RecruiterReviewLinkListCreateView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Các link mời đánh giá hồ sơ', responses={200: ReviewLinkSerializer(many=True)}
    )
    def get(self, request, public_id):
        application = _application(request, public_id)
        links = recruiter_review_links_queryset(application)
        return Response(ReviewLinkSerializer(links, many=True).data)

    @extend_schema(
        summary='Tạo link mời đánh giá (token chỉ trả về một lần)',
        request=ReviewLinkCreateSerializer,
        responses={
            201: inline_serializer(
                'ReviewLinkCreated',
                {'link': ReviewLinkSerializer(), 'url': serializers.URLField()},
            )
        },
    )
    def post(self, request, public_id):
        application = _application(request, public_id)
        serializer = ReviewLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link, raw_token = create_review_link(
                application, actor=request.user, **serializer.validated_data
            )
        except ReviewNotShareable as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(
            {'link': ReviewLinkSerializer(link).data, 'url': review_page_url(raw_token)},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=['applications-v2'], summary='Thu hồi link mời đánh giá', request=None)
class RecruiterReviewLinkRevokeView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request, public_id, link_public_id):
        application = _application(request, public_id)
        try:
            link = revoke_review_link(application, link_public_id=link_public_id)
        except ReviewLinkUnavailable as error:
            raise Http404 from error
        return Response(ReviewLinkSerializer(link).data)


@extend_schema(
    tags=['applications-v2'],
    summary='Phiếu đánh giá của người được mời và tổng hợp',
    responses={
        200: inline_serializer(
            'ApplicationReviewList',
            {
                'summary': serializers.DictField(),
                'results': ApplicationReviewSerializer(many=True),
            },
        )
    },
)
class RecruiterApplicationReviewListView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request, public_id):
        reviews = recruiter_reviews_queryset(_application(request, public_id))
        return Response(
            {
                'summary': review_summary(reviews),
                'results': ApplicationReviewSerializer(reviews, many=True).data,
            }
        )


@extend_schema(tags=['applications-v2'])
class PublicApplicationReviewView(APIView):
    """Bearer endpoint for invited reviewers; bad, expired and revoked links all 404."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'application_review'

    @extend_schema(summary='Người được mời xem hồ sơ đã ẩn thông tin liên hệ')
    def get(self, request, token):
        try:
            link = open_review_link(token, request=request)
        except ReviewLinkUnavailable as error:
            raise Http404 from error
        return Response(reviewer_payload(link, request))

    @extend_schema(
        summary='Gửi hoặc cập nhật phiếu đánh giá',
        request=ReviewSubmitSerializer,
        responses={200: ApplicationReviewSerializer},
    )
    def put(self, request, token):
        serializer = ReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            review = submit_review(token, **serializer.validated_data)
        except ReviewLinkUnavailable as error:
            raise Http404 from error
        return Response(ApplicationReviewSerializer(review).data)
