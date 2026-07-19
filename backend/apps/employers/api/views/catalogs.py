from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...models import Company, Industry
from ..serializers import IndustrySerializer


class IndustryListView(generics.ListAPIView):
    """Danh sách lĩnh vực công ty cho bộ lọc "Lĩnh vực công ty" (chỉ những lĩnh vực đang có công ty)."""

    serializer_class = IndustrySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Industry.objects.filter(companies__isnull=False).distinct()


class AllIndustryListView(generics.ListAPIView):
    """Toàn bộ lĩnh vực — cho dropdown chọn lĩnh vực khi tạo hồ sơ công ty."""

    serializer_class = IndustrySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = Industry.objects.all()


class CompanyCatalogView(APIView):
    """Source-of-truth cho các lựa chọn của form công ty."""

    permission_classes = [IsEmployer]

    @staticmethod
    def _choices(choices):
        return [{'value': value, 'label': label} for value, label in choices]

    @extend_schema(
        summary='Danh mục lựa chọn cho form thông tin công ty',
        responses=inline_serializer('CompanyCatalogResponse', fields={
            key: serializers.ListField(child=serializers.DictField())
            for key in ('business_types', 'company_sizes', 'markets', 'target_customers')
        }),
        tags=['employer'],
    )
    def get(self, request):
        return Response({
            'business_types': self._choices(Company.BusinessType.choices),
            'company_sizes': self._choices(Company.Size.choices),
            'markets': self._choices(Company.Market.choices),
            'target_customers': self._choices(Company.TargetCustomer.choices),
        })
