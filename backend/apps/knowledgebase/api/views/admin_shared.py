"""Cache, metrics and lookup plumbing shared by every knowledgebase admin view."""

from time import monotonic

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from common.metrics import record_metric

from ...selectors import (
    admin_article_detail_queryset,
    admin_categories_queryset,
    article_audit_events,
)
from ..serializers import (
    AdminArticleDetailSerializer,
    AdminCategorySerializer,
)

ERROR_RESPONSES = {
    400: OpenApiResponse(
        description='Dữ liệu không hợp lệ.',
        examples=[
            OpenApiExample('Validation error', value={'body': ['Nội dung không được để trống.']})
        ],
    ),
    403: OpenApiResponse(
        description='Thiếu permission quản trị.',
        examples=[OpenApiExample('Forbidden', value={'detail': 'Bạn không có quyền thực hiện.'})],
    ),
    409: OpenApiResponse(
        description='Xung đột trạng thái hoặc revision token cũ.',
        examples=[
            OpenApiExample(
                'Stale revision',
                value={
                    'code': 'knowledgebase_revision_stale',
                    'detail': 'Nội dung đã thay đổi trên máy chủ.',
                    'current_revision_token': 4,
                },
            )
        ],
    ),
}


class PrivateNoStoreMixin:
    def initial(self, request, *args, **kwargs):
        self._knowledgebase_started_at = monotonic()
        return super().initial(request, *args, **kwargs)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        endpoint = request.resolver_match.url_name or 'unknown'
        status_code = response.status_code
        tags = {
            'endpoint': endpoint,
            'status': status_code,
            'failure_code': (
                response.data.get('code', f'http_{status_code}')
                if status_code >= 400 and isinstance(response.data, dict)
                else ''
            ),
        }
        record_metric('knowledgebase_admin_request', 1, **tags)
        record_metric(
            'knowledgebase_admin_latency_ms',
            round((monotonic() - self._knowledgebase_started_at) * 1000, 2),
            **tags,
        )
        return response


def category_or_404(public_id):
    return get_object_or_404(admin_categories_queryset(), public_id=public_id)


def article_or_404(public_id):
    return get_object_or_404(admin_article_detail_queryset(), public_id=public_id)


def category_response(request, category, *, response_status=status.HTTP_200_OK):
    refreshed = category_or_404(category.public_id)
    return Response(
        AdminCategorySerializer(refreshed, context={'request': request}).data,
        status=response_status,
    )


def article_response(request, article, *, response_status=status.HTTP_200_OK):
    refreshed = article_or_404(article.public_id)
    return Response(
        AdminArticleDetailSerializer(
            refreshed,
            context={
                'request': request,
                'audit_events': article_audit_events(refreshed.public_id),
            },
        ).data,
        status=response_status,
    )
