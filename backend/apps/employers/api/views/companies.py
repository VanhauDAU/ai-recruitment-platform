import random

from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response

from apps.accounts.api.permissions import IsEmployer
from common.api.throttling import ClientIPScopedRateThrottle

from ...selectors import (
    attach_active_public_job_counts,
    featured_public_companies,
    public_company_search_queryset,
    search_companies,
)
from ...services import create_company_for_recruiter
from ..permissions import require_company_recruiter
from ..serializers import CompanySearchSerializer, CompanySerializer, PublicCompanyListSerializer

QUERY_PARAMETER = OpenApiParameter('q', str, OpenApiParameter.QUERY, required=False)


@extend_schema_view(get=extend_schema(summary='Công ty tôi đang liên kết', tags=['employer']))
class MyCompanyView(generics.RetrieveAPIView):
    """Công ty của tôi — chỉ đọc; thay đổi thông tin đi qua update-requests."""

    serializer_class = CompanySerializer
    permission_classes = [IsEmployer]

    def get_object(self):
        return require_company_recruiter(self.request.user).company


@extend_schema_view(
    post=extend_schema(summary='Tạo hồ sơ công ty mới và trở thành owner', tags=['employer'])
)
class CreateCompanyView(generics.CreateAPIView):
    """Tạo hồ sơ công ty mới (thẻ 2) — có hiệu lực ngay, người tạo là owner."""

    serializer_class = CompanySerializer
    permission_classes = [IsEmployer]

    def perform_create(self, serializer):
        serializer.instance = create_company_for_recruiter(
            self.request.user, serializer.validated_data
        )


@extend_schema_view(
    get=extend_schema(
        summary='Tìm công ty có sẵn theo tên, tên thương mại hoặc MST',
        parameters=[QUERY_PARAMETER],
        tags=['employer'],
    )
)
class CompanySearchView(generics.ListAPIView):
    """Tìm công ty có sẵn (thẻ 1) theo tên, tên thương mại hoặc MST."""

    serializer_class = CompanySearchSerializer
    permission_classes = [IsEmployer]

    class Pagination(PageNumberPagination):
        page_size = 6
        page_size_query_param = None

    pagination_class = Pagination

    def get_queryset(self):
        return search_companies(self.request.query_params.get('q'))


class PublicCompanyCursorPagination(CursorPagination):
    page_size = 18
    ordering = 'slug'

    def paginate_queryset(self, queryset, request, view=None):
        # The directory UI needs an exact total only when a search is reset.
        # Cursor pages reuse that first-page value, so do not repeat the global
        # eligibility count throughout infinite scroll.
        self.include_total_count = self.cursor_query_param not in request.query_params
        if self.include_total_count:
            self.total_count = queryset.count()
        return super().paginate_queryset(queryset, request, view=view)

    def get_paginated_response(self, data):
        payload = {
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        }
        if self.include_total_count:
            payload = {'count': self.total_count, **payload}
        return Response(payload)


@extend_schema_view(
    get=extend_schema(
        summary='Danh bạ công ty công khai: nổi bật, hoặc tìm theo q (cursor)',
        parameters=[QUERY_PARAMETER],
    )
)
class PublicCompanyListView(generics.ListAPIView):
    """Public featured companies by default; cursor search when ``q`` is set."""

    MAX_QUERY_LENGTH = 120
    FEATURED_LIMIT = 18

    serializer_class = PublicCompanyListSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = PublicCompanyCursorPagination
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'public_companies'

    def _query(self):
        if hasattr(self, '_validated_public_company_query'):
            return self._validated_public_company_query
        query = (self.request.query_params.get('q') or '').strip()
        if len(query) > self.MAX_QUERY_LENGTH:
            raise ValidationError({'q': _('Từ khóa tìm kiếm không được vượt quá 120 ký tự.')})
        self._validated_public_company_query = query
        return query

    def get_queryset(self):
        return public_company_search_queryset(query=self._query())

    def list(self, request, *args, **kwargs):
        if self._query():
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            page = attach_active_public_job_counts(page)
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        # The selector performs one canonical aggregate, ranks and bounds the
        # finite pool. Shuffle only those rows, never a cursor-backed queryset.
        featured_companies = featured_public_companies(limit=self.FEATURED_LIMIT)
        random.shuffle(featured_companies)
        serializer = self.get_serializer(featured_companies, many=True)
        response = Response(
            {
                'next': None,
                'previous': None,
                'results': serializer.data,
            }
        )
        response['Cache-Control'] = 'no-store'
        return response
