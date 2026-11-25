"""Pure definitions shared by locations models, selectors and other apps."""

from .geo import (
    COORDINATE_DECIMALS,
    EARTH_RADIUS_KM,
    VN_BOUNDS,
    BoundingBox,
    bounding_box,
    haversine_km,
    is_in_vietnam,
    is_valid_coordinate,
    normalize_geocode_key,
    polygon_label_point,
    round_coordinate,
)

__all__ = [
    'COORDINATE_DECIMALS',
    'EARTH_RADIUS_KM',
    'VN_BOUNDS',
    'BoundingBox',
    'bounding_box',
    'haversine_km',
    'is_in_vietnam',
    'is_valid_coordinate',
    'normalize_geocode_key',
    'polygon_label_point',
    'round_coordinate',
]
