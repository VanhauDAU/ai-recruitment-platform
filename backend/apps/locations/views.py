from rest_framework import generics, permissions

from .models import Location
from .serializers import LocationSerializer


class LocationListView(generics.ListAPIView):
    """Cascading lookup for address selects: ?level=province or ?level=ward&parent=<id>, plus ?search=."""

    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Location.objects.filter(is_active=True)
        params = self.request.query_params
        if level := params.get('level'):
            qs = qs.filter(level=level)
        if parent := params.get('parent'):
            qs = qs.filter(parent_id=parent)
        if search := params.get('search'):
            qs = qs.filter(name__icontains=search)
        return qs.order_by('name')[:200]
