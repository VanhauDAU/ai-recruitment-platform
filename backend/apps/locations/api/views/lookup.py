from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions

from ...selectors import location_lookup_queryset
from ..serializers import LocationLookupSerializer


@extend_schema(
    summary='Tra cứu địa điểm theo cấp (tỉnh/xã)',
    parameters=[
        OpenApiParameter('ids', str, description='Danh sách id, phân tách bằng dấu phẩy'),
        OpenApiParameter('level', str, description='province hoặc ward'),
        OpenApiParameter('parent', str, description='Id cấp cha, phân tách bằng dấu phẩy'),
        OpenApiParameter('search', str, description='Tìm theo tên'),
    ],
    tags=['locations'],
)
class LocationListView(generics.ListAPIView):
    """Cascading lookup for address selects: ?level=province or ?level=ward&parent=<id>, plus ?search=."""

    serializer_class = LocationLookupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # bounded lookup — selector đã cap kết quả

    def get_queryset(self):
        return location_lookup_queryset(self.request.query_params)
