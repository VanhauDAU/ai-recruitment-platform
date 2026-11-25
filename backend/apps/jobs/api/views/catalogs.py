from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions

from common.api.caching import cache_public_get
from common.api.params import parse_bool

from ...selectors import (
    active_benefits_queryset,
    active_job_categories_queryset,
    active_languages_queryset,
)
from ..serializers import (
    BenefitSerializer,
    JobCategoryListSerializer,
    LanguageSerializer,
)


@extend_schema(
    tags=['jobs'],
    summary='Danh mục ngành nghề đang dùng',
    parameters=[
        OpenApiParameter('category_type', str),
        OpenApiParameter('all', str, description='`1`/`true`: trả toàn bộ, không phân trang.'),
    ],
)
@cache_public_get(query_params=('category_type', 'all', 'page', 'page_size'))
class JobCategoryListView(generics.ListAPIView):
    serializer_class = JobCategoryListSerializer
    permission_classes = [permissions.AllowAny]

    def paginate_queryset(self, queryset):
        # Search pickers need the whole bounded taxonomy. Keep normal pagination
        # as the API default for other consumers.
        if parse_bool(self.request.query_params.get('all')):
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        return active_job_categories_queryset(
            category_type=self.request.query_params.get('category_type')
        )


@extend_schema(tags=['jobs'], summary='Danh mục quyền lợi')
@cache_public_get()
class BenefitListView(generics.ListAPIView):
    serializer_class = BenefitSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_benefits_queryset()


@extend_schema(tags=['jobs'], summary='Danh mục ngoại ngữ')
@cache_public_get()
class LanguageListView(generics.ListAPIView):
    serializer_class = LanguageSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_languages_queryset()
