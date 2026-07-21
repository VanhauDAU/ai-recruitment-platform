from rest_framework import generics, permissions

from ...selectors import location_lookup_queryset
from ..serializers import LocationLookupSerializer


class LocationListView(generics.ListAPIView):
    """Cascading lookup for address selects: ?level=province or ?level=ward&parent=<id>, plus ?search=."""

    serializer_class = LocationLookupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # bounded lookup — selector đã cap kết quả

    def get_queryset(self):
        return location_lookup_queryset(self.request.query_params)
