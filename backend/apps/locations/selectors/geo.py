"""Read-side geographic lookups backed by ward/province centroids (no provider calls)."""

from common.db.search import search_q

from ..domain import bounding_box, haversine_km
from ..models import Location

# Nới dần vùng tìm: phường đô thị cách nhau 1–3 km, xã miền núi có thể 20–40 km.
_NEAREST_WARD_RADII_KM = (5, 20, 60)
WARD_SEARCH_LIMIT = 8


def _with_centroid(queryset):
    return queryset.filter(latitude__isnull=False, longitude__isnull=False)


def nearest_ward(lat, lng):
    """Ward whose centroid is closest to (lat, lng), with its province; None when no
    centroid lies within 60 km (outside Vietnam or coordinates not seeded)."""
    wards = _with_centroid(Location.objects.filter(level=Location.Level.WARD)).select_related(
        'parent'
    )
    for radius in _NEAREST_WARD_RADII_KM:
        box = bounding_box(lat, lng, radius)
        candidates = list(
            wards.filter(
                latitude__range=(box.south, box.north),
                longitude__range=(box.west, box.east),
            ).only('id', 'name', 'slug', 'latitude', 'longitude', 'parent__id', 'parent__name')
        )
        if candidates:
            return min(candidates, key=lambda w: haversine_km(lat, lng, w.latitude, w.longitude))
    return None


def province_of_point(lat, lng):
    ward = nearest_ward(lat, lng)
    return ward.parent if ward else None


def search_wards(text, limit=WARD_SEARCH_LIMIT):
    """Active wards with a centroid whose name matches every token (accent-insensitive)."""
    text = (text or '').strip()
    if not text:
        return []
    queryset = _with_centroid(
        Location.objects.filter(level=Location.Level.WARD, is_active=True)
    ).select_related('parent')
    return list(queryset.filter(search_q('name', text)).order_by('name')[:limit])


def ward_by_slug(slug):
    return (
        _with_centroid(Location.objects.filter(level=Location.Level.WARD, slug=slug))
        .select_related('parent')
        .first()
    )
