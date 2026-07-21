"""Read-side queries for address lookups."""

from ..models import Location

LOOKUP_CAP = 500  # bounded lookup — trả toàn bộ trong một response, không phân trang


def location_lookup_queryset(params):
    """Cascading lookup cho select địa chỉ: ids | level/parent | search."""
    qs = Location.objects.filter(is_active=True).only(
        'id',
        'name',
        'level',
        'parent_id',
        'merged_from',
    )
    if ids := params.get('ids'):
        id_list = [int(x) for x in ids.split(',') if x.strip().isdigit()]
        if id_list:
            return qs.filter(id__in=id_list).order_by('level', 'name')[:LOOKUP_CAP]
    if level := params.get('level'):
        qs = qs.filter(level=level)
    if parent := params.get('parent'):
        parent_ids = [int(x) for x in str(parent).split(',') if x.strip().isdigit()]
        qs = qs.filter(parent_id__in=parent_ids) if parent_ids else qs.none()
    if search := params.get('search'):
        qs = qs.filter(name__icontains=search)
    return qs.order_by('name')[:LOOKUP_CAP]
