from rest_framework import generics, permissions

from ...models import Industry
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
