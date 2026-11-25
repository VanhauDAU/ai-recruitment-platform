"""Pure geometry helpers for "nearby" features (ADR-0029: no PostGIS).

Coordinates are WGS84 degrees. Distances use the haversine great-circle formula,
accurate to well under 0.5% at the city scale the job search works at.
"""

import math
import re
import unicodedata
from dataclasses import dataclass

EARTH_RADIUS_KM = 6371.0088
COORDINATE_DECIMALS = 3  # ~110 m: candidate origins are rounded to this before querying

# Mainland + islands of Vietnam, padded slightly. Used to reject points that are
# obviously elsewhere (geocoder mismatch, a pin dropped in the sea, a VPN location).
VN_BOUNDS = (7.0, 102.0, 23.5, 117.9)  # (south, west, north, east)


@dataclass(frozen=True)
class BoundingBox:
    south: float
    west: float
    north: float
    east: float


def haversine_km(lat1, lng1, lat2, lng2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def bounding_box(lat, lng, radius_km):
    """Smallest lat/lng box containing the circle; prefilter for an indexed range scan."""
    d_lat = math.degrees(radius_km / EARTH_RADIUS_KM)
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    d_lng = math.degrees(radius_km / (EARTH_RADIUS_KM * cos_lat))
    return BoundingBox(lat - d_lat, lng - d_lng, lat + d_lat, lng + d_lng)


def round_coordinate(value, decimals=COORDINATE_DECIMALS):
    return round(float(value), decimals)


def is_valid_coordinate(lat, lng):
    return lat is not None and lng is not None and -90 <= lat <= 90 and -180 <= lng <= 180


def is_in_vietnam(lat, lng):
    south, west, north, east = VN_BOUNDS
    return is_valid_coordinate(lat, lng) and south <= lat <= north and west <= lng <= east


def normalize_geocode_key(*parts):
    """Stable cache key for an address: accent/case/space-insensitive."""
    text = ' | '.join(str(part) for part in parts if part not in (None, ''))
    text = text.replace('đ', 'd').replace('Đ', 'D')
    text = ''.join(c for c in unicodedata.normalize('NFD', text) if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', text).strip().lower()[:500]


# ─── Polygon centroids (used offline to build ward/province centres) ───


def _ring_area_centroid(ring):
    area = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=False):
        cross = x1 * y2 - x2 * y1
        area += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    area /= 2
    if abs(area) < 1e-12:
        xs, ys = zip(*ring, strict=False)
        return 0.0, sum(xs) / len(xs), sum(ys) / len(ys)
    return area, cx / (6 * area), cy / (6 * area)


def _point_in_ring(x, y, ring):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=False):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _point_in_polygon(x, y, polygon):
    outer, *holes = polygon
    return _point_in_ring(x, y, outer) and not any(_point_in_ring(x, y, h) for h in holes)


def _interior_point(polygon, y):
    """Midpoint of the widest horizontal chord at latitude y (always inside)."""
    xs = []
    for ring in polygon:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=False):
            if (y1 > y) != (y2 > y):
                xs.append((x2 - x1) * (y - y1) / (y2 - y1) + x1)
    xs.sort()
    chords = [(xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2) for i in range(0, len(xs) - 1, 2)]
    return max(chords)[1] if chords else None


def polygon_label_point(geometry):
    """(lat, lng) for a GeoJSON Polygon/MultiPolygon: the area centroid of its largest
    part, nudged inside the shape when the centroid falls outside (concave wards)."""
    if geometry['type'] == 'Polygon':
        polygons = [geometry['coordinates']]
    elif geometry['type'] == 'MultiPolygon':
        polygons = geometry['coordinates']
    else:
        raise ValueError(f'Unsupported geometry {geometry["type"]}')
    rings = [[[(float(x), float(y)) for x, y, *_ in ring] for ring in poly] for poly in polygons]
    scored = [(abs(_ring_area_centroid(poly[0])[0]), poly) for poly in rings if poly and poly[0]]
    _, largest = max(scored, key=lambda item: item[0])
    _, x, y = _ring_area_centroid(largest[0])
    if not _point_in_polygon(x, y, largest):
        inner_x = _interior_point(largest, y)
        if inner_x is not None:
            x = inner_x
    return round(y, 6), round(x, 6)
