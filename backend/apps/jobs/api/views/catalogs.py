from rest_framework import generics, permissions

from ...models import Benefit, JobCategory, Language
from ..serializers import (
    BenefitSerializer,
    JobCategoryListSerializer,
    LanguageSerializer,
)


class JobCategoryListView(generics.ListAPIView):
    serializer_class = JobCategoryListSerializer
    permission_classes = [permissions.AllowAny]

    def paginate_queryset(self, queryset):
        # Search pickers need the whole bounded taxonomy. Keep normal pagination
        # as the API default for other consumers.
        if self.request.query_params.get('all') in {'1', 'true'}:
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        queryset = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE).only(
            'id', 'name', 'logo_url', 'parent_id', 'category_type',
        )
        if category_type := self.request.query_params.get('category_type'):
            queryset = queryset.filter(category_type=category_type)
        return queryset


class BenefitListView(generics.ListAPIView):
    serializer_class = BenefitSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Benefit.objects.filter(is_active=True)


class LanguageListView(generics.ListAPIView):
    serializer_class = LanguageSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Language.objects.filter(is_active=True)
