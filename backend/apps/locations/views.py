from rest_framework import generics, permissions

from .models import Location
from .serializers import LocationSerializer


class LocationListView(generics.ListAPIView):
    """Cascading lookup for address selects: ?level=province or ?level=ward&parent=<id>, plus ?search=."""

    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # bounded lookup (capped below) — return the full list in one response

    def get_queryset(self):
        qs = Location.objects.filter(is_active=True)
        params = self.request.query_params
        if ids := params.get('ids'):
            id_list = [int(x) for x in ids.split(',') if x.strip().isdigit()]
            if id_list:
                return qs.filter(id__in=id_list).order_by('level', 'name')[:500]
        if level := params.get('level'):
            qs = qs.filter(level=level)
        if parent := params.get('parent'):
            parent_ids = [int(x) for x in str(parent).split(',') if x.strip().isdigit()]
            qs = qs.filter(parent_id__in=parent_ids) if parent_ids else qs.none()
        if search := params.get('search'):
            qs = qs.filter(name__icontains=search)
        return qs.order_by('name')[:500]
