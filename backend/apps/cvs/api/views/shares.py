"""Revocable bearer links to one immutable CV version: owner management and public reads."""

from django.http import Http404
from drf_spectacular.utils import OpenApiTypes, extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cvs.api.serializers import CvSharedLinkCreateSerializer, CvSharedLinkSerializer
from apps.cvs.selectors import cv_shared_links_queryset
from apps.cvs.services import (
    CvSharePermissionError,
    CvShareUnavailableError,
    create_shared_link,
    resolve_shared_link,
    revoke_shared_link,
)

from .base import (
    CandidateCvMixin,
    read_only_cv_payload,
    read_only_cv_schema,
    uploaded_cv_pdf_response,
)


class CvSharedLinkListCreateView(CandidateCvMixin, APIView):
    """Owner-scoped shared-link management; raw token is returned exactly once."""

    @extend_schema(
        summary='Danh sách link chia sẻ của CV',
        responses={200: CvSharedLinkSerializer(many=True)},
        tags=['cvs'],
    )
    def get(self, request, public_id):
        links = cv_shared_links_queryset(self.get_cv())
        return Response(CvSharedLinkSerializer(links, many=True).data)

    @extend_schema(
        summary='Tạo link chia sẻ (token trả về đúng một lần)',
        request=CvSharedLinkCreateSerializer,
        responses={
            201: inline_serializer(
                'CvSharedLinkCreated',
                {
                    'link': CvSharedLinkSerializer(),
                    'token': serializers.CharField(),
                },
            )
        },
        tags=['cvs'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        serializer = CvSharedLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link, raw_token = create_shared_link(
                cv=cv,
                actor=request.user,
                version_public_id=serializer.validated_data.get('version_public_id'),
                expires_at=serializer.validated_data.get('expires_at'),
            )
        except CvSharePermissionError as error:
            raise PermissionDenied(str(error)) from error
        return Response(
            {'link': CvSharedLinkSerializer(link).data, 'token': raw_token},
            status=status.HTTP_201_CREATED,
        )


class CvSharedLinkRevokeView(CandidateCvMixin, APIView):
    @extend_schema(summary='Thu hồi link chia sẻ', responses={204: None}, tags=['cvs'])
    def delete(self, request, public_id, link_public_id):
        cv = self.get_cv()
        try:
            revoke_shared_link(
                cv=cv,
                actor=request.user,
                link_public_id=link_public_id,
            )
        except CvShareUnavailableError as error:
            raise Http404 from error
        except CvSharePermissionError as error:
            raise PermissionDenied(str(error)) from error
        return Response(status=status.HTTP_204_NO_CONTENT)


class CvSharedLinkPublicView(APIView):
    """Unauthenticated bearer endpoint. Invalid/revoked/expired links are indistinguishable."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        summary='Xem CV qua link chia sẻ (không cần đăng nhập)',
        responses={200: read_only_cv_schema('SharedCvView', 'SharedCvSummary')},
        tags=['cvs'],
    )
    def get(self, request, token):
        try:
            link, version = resolve_shared_link(raw_token=token, request=request)
        except CvShareUnavailableError as error:
            raise Http404 from error
        return Response(read_only_cv_payload(link.cv, version, request))


class CvSharedSourceFileView(APIView):
    """Original file of an uploaded CV behind a valid share link."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        summary='Tệp gốc của CV tải lên qua link chia sẻ (PDF)',
        responses={(200, 'application/pdf'): OpenApiTypes.BINARY},
        tags=['cvs'],
    )
    def get(self, request, token):
        try:
            # Lượt xem đã được ghi ở endpoint trang chia sẻ; tệp là một phần của lượt đó.
            link, _version = resolve_shared_link(raw_token=token, request=request, audit=False)
        except CvShareUnavailableError as error:
            raise Http404 from error
        return uploaded_cv_pdf_response(link.cv)
