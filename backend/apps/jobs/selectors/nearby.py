"""Nearby-jobs search without PostGIS (ADR-0029).

A job matches when any workplace lies within the radius (indexed lat/lng box,
then exact haversine in SQL), or — for "Tất cả"/legacy province rows — when the
candidate's point is inside that province. Remote-only jobs are opt-in.
"""

from dataclasses import dataclass

from django.db.models import (
    Case,
    CharField,
    Exists,
    F,
    FloatField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import ASin, Coalesce, Cos, Least, Power, Radians, Sin, Sqrt
from rest_framework.exceptions import ValidationError

from apps.locations.domain import EARTH_RADIUS_KM, bounding_box, is_in_vietnam, round_coordinate
from apps.locations.selectors import nearest_ward
from apps.sitecontent.selectors import get_bool_setting, get_int_setting
from common.api.params import parse_bool

from ..models import Job, JobLocation
from .listing import _order_jobs, filter_job_list_queryset

RADIUS_OPTIONS_KM = (3, 5, 10, 20, 50)
RADIUS_HARD_CAP_KM = 100
NEARBY_ORDERINGS = {'distance', 'newest', 'salary_desc'}


class MatchKind:
    DISTANCE = 'distance'
    PROVINCE_WIDE = 'province_wide'
    REMOTE = 'remote'


@dataclass(frozen=True)
class NearbyOrigin:
    latitude: float
    longitude: float
    radius_km: int
    include_province_wide: bool
    include_remote: bool
    ward: object  # Location | None — nearest ward, gives the province and a label

    @property
    def province(self):
        return self.ward.parent if self.ward else None


def nearby_enabled():
    return get_bool_setting('nearby_jobs_enabled', True)


def nearby_radius_limits():
    maximum = min(max(get_int_setting('nearby_jobs_max_radius_km', 50), 1), RADIUS_HARD_CAP_KM)
    default = min(max(get_int_setting('nearby_jobs_default_radius_km', 10), 1), maximum)
    return default, maximum


def max_markers():
    return min(max(get_int_setting('nearby_jobs_max_markers', 300), 1), 1000)


def _coordinate(params, name):
    try:
        return float(params.get(name, ''))
    except (TypeError, ValueError):
        raise ValidationError({name: 'Thiếu hoặc sai tọa độ.'}) from None


def parse_nearby_origin(params):
    """Validated search origin. Coordinates are rounded to ~110 m on the server so
    precise positions are never used (or cached) beyond what the search needs."""
    lat = round_coordinate(_coordinate(params, 'lat'))
    lng = round_coordinate(_coordinate(params, 'lng'))
    if not is_in_vietnam(lat, lng):
        raise ValidationError({'lat': 'Chỉ hỗ trợ tìm việc trong lãnh thổ Việt Nam.'})
    default, maximum = nearby_radius_limits()
    try:
        radius = float(params.get('radius_km') or default)
    except (TypeError, ValueError):
        radius = default
    radius = int(min(max(radius, 1), maximum))
    return NearbyOrigin(
        latitude=lat,
        longitude=lng,
        radius_km=radius,
        include_province_wide=parse_bool(params.get('include_province_wide'), True),
        include_remote=parse_bool(params.get('include_remote'), False),
        ward=nearest_ward(lat, lng),
    )


def _distance_km(origin):
    """Haversine distance from the origin to the row's latitude/longitude, in SQL."""
    lat, lng = Radians(F('latitude')), Radians(F('longitude'))
    origin_lat = Radians(Value(origin.latitude, output_field=FloatField()))
    origin_lng = Radians(Value(origin.longitude, output_field=FloatField()))
    half_chord = Power(Sin((lat - origin_lat) / 2), 2) + Cos(origin_lat) * Cos(lat) * Power(
        Sin((lng - origin_lng) / 2), 2
    )
    return Value(2 * EARTH_RADIUS_KM) * ASin(Sqrt(Least(half_chord, Value(1.0))))


def workplaces_within(origin, radius_km=None):
    radius = radius_km or origin.radius_km
    box = bounding_box(origin.latitude, origin.longitude, radius)
    return (
        JobLocation.objects.filter(
            latitude__range=(box.south, box.north), longitude__range=(box.west, box.east)
        )
        .annotate(distance_km=_distance_km(origin))
        .filter(distance_km__lte=radius)
    )


def _remote_only_filter():
    return Q(work_types=[Job.WorkType.REMOTE]) | Q(work_types=[], work_type=Job.WorkType.REMOTE)


def _matching_jobs(params, origin, radius_km=None):
    """Filtered public jobs matching the origin, annotated with distance/match kind."""
    within = workplaces_within(origin, radius_km)
    province_wide = Q(pk__in=[])
    if origin.include_province_wide and origin.province:
        province_wide = Exists(
            JobLocation.objects.filter(
                job_id=OuterRef('pk'),
                location_id=origin.province.pk,
                latitude__isnull=True,
            )
        )
    remote_only = _remote_only_filter()
    match = Exists(within.filter(job_id=OuterRef('pk'))) | province_wide
    queryset = filter_job_list_queryset(params)
    if origin.include_remote:
        queryset = queryset.filter(match | remote_only)
    else:
        queryset = queryset.filter(match).exclude(remote_only)
    nearest = within.filter(job_id=OuterRef('pk')).order_by('distance_km').values('distance_km')
    return queryset.annotate(
        distance_km=Subquery(nearest[:1], output_field=FloatField()),
        match_kind=Case(
            When(distance_km__isnull=False, then=Value(MatchKind.DISTANCE)),
            When(province_wide, then=Value(MatchKind.PROVINCE_WIDE)),
            default=Value(MatchKind.REMOTE),
            output_field=CharField(),
        ),
    )


def build_nearby_queryset(params, origin):
    """Paginated feed: by distance (default), province-wide next, remote last."""
    ordering = params.get('ordering') or 'distance'
    if ordering not in NEARBY_ORDERINGS:
        raise ValidationError({'ordering': 'Invalid ordering.'})
    within = workplaces_within(origin).select_related('location__parent').order_by('distance_km')
    queryset = _matching_jobs(params, origin).prefetch_related(
        Prefetch('job_locations', queryset=within, to_attr='nearby_workplaces')
    )
    if ordering != 'distance':
        return _order_jobs(queryset, ordering)
    kind_rank = Case(
        When(match_kind=MatchKind.DISTANCE, then=0),
        When(match_kind=MatchKind.PROVINCE_WIDE, then=1),
        default=2,
    )
    return queryset.annotate(
        kind_rank=kind_rank,
        lifecycle_recency=Coalesce('first_approved_at', 'published_at', 'created_at'),
    ).order_by('kind_rank', F('distance_km').asc(nulls_last=True), '-lifecycle_recency', '-id')


def expand_radius_suggestion(params, origin):
    """First larger radius option with results — shown when the current one is empty."""
    _, maximum = nearby_radius_limits()
    for radius in RADIUS_OPTIONS_KM:
        if origin.radius_km < radius <= maximum:
            count = _matching_jobs(params, origin, radius).filter(distance_km__isnull=False).count()
            if count:
                return {'radius_km': radius, 'count': count}
    return None


def build_nearby_markers(params, origin):
    """Workplaces within the radius for the map, nearest first, grouped by point.

    Returns ``(points, truncated)``; each point carries the jobs found there."""
    limit = max_markers()
    job_ids = _matching_jobs(params, origin).filter(distance_km__isnull=False).values('pk')
    rows = list(
        workplaces_within(origin)
        .filter(job_id__in=job_ids)
        .select_related('job__company', 'location__parent')
        .order_by('distance_km', 'job_id')[: limit + 1]
    )
    truncated = len(rows) > limit
    points = {}
    for row in rows[:limit]:
        key = (round(row.latitude, 5), round(row.longitude, 5))
        point = points.setdefault(
            key,
            {
                'latitude': row.latitude,
                'longitude': row.longitude,
                'precision': row.coordinate_precision,
                'distance_km': row.distance_km,
                'label': row.location.name,
                'workplaces': [],
            },
        )
        point['workplaces'].append(row)
    return list(points.values()), truncated
