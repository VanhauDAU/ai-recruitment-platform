"""Address lookup for "Việc làm gần bạn": local wards first, then the provider.

Coordinates sent here are never stored: only rounded to bias provider suggestions.
"""

from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ...domain import is_in_vietnam, round_coordinate
from ...selectors import search_wards, ward_by_slug
from ...services import autocomplete_places, resolve_place
from ..serializers import GeoPlaceLabelSerializer, GeoPointSerializer, GeoSuggestionSerializer

MIN_QUERY_LENGTH = 2
MAX_QUERY_LENGTH = 120


def _focus(params):
    """Optional bias point for provider suggestions, rounded to ~1 km; None if absent."""
    try:
        lat, lng = float(params['lat']), float(params['lng'])
    except (KeyError, TypeError, ValueError):
        return None
    return (round_coordinate(lat, 2), round_coordinate(lng, 2)) if is_in_vietnam(lat, lng) else None


def _ward_label(ward):
    return {
        'ward_id': ward.pk,
        'ward_name': ward.name,
        'ward_slug': ward.slug,
        'province_id': ward.parent.pk,
        'province_name': ward.parent.name,
        'latitude': ward.latitude,
        'longitude': ward.longitude,
    }


class _GeoView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'geo_lookup'


@extend_schema(
    tags=['locations'],
    summary='Gợi ý vị trí: phường/xã có sẵn rồi địa chỉ từ nhà cung cấp bản đồ',
    parameters=[
        OpenApiParameter('q', str, required=True),
        OpenApiParameter('lat', float, description='Ưu tiên gợi ý gần điểm này'),
        OpenApiParameter('lng', float),
    ],
    responses=GeoSuggestionSerializer(many=True),
)
class GeoAutocompleteView(_GeoView):
    def get(self, request):
        text = (request.query_params.get('q') or '').strip()[:MAX_QUERY_LENGTH]
        if len(text) < MIN_QUERY_LENGTH:
            return Response([])
        results = [
            {
                'type': 'ward',
                'ref': f'ward:{ward.slug}',
                'label': ward.name,
                'secondary': ward.parent.name if ward.parent else '',
                'latitude': ward.latitude,
                'longitude': ward.longitude,
                'slug': ward.slug,
            }
            for ward in search_wards(text, limit=4)
        ]
        focus = _focus(request.query_params)
        results += [
            {
                'type': 'place',
                'ref': place.ref,
                'label': place.label,
                'secondary': place.secondary,
                'latitude': None,
                'longitude': None,
                'slug': '',
            }
            for place in autocomplete_places(text, focus)
        ]
        return Response(GeoSuggestionSerializer(results, many=True).data)


@extend_schema(
    tags=['locations'],
    summary='Tọa độ của một gợi ý địa chỉ',
    parameters=[OpenApiParameter('ref', str, required=True)],
    responses=GeoPointSerializer,
)
class GeoPlaceView(_GeoView):
    def get(self, request):
        ref = (request.query_params.get('ref') or '').strip()[:500]
        if ref.startswith('ward:'):
            ward = ward_by_slug(ref.removeprefix('ward:'))
            point = ward and {
                'latitude': ward.latitude,
                'longitude': ward.longitude,
                'label': ward.name,
            }
        else:
            place = resolve_place(ref) if ref else None
            point = place and {
                'latitude': place.latitude,
                'longitude': place.longitude,
                'label': place.label,
            }
        if not point:
            raise Http404
        return Response(GeoPointSerializer(point).data)


@extend_schema(
    tags=['locations'],
    summary='Phường/xã theo slug (gốc tìm việc gần chia sẻ được qua URL)',
    responses=GeoPlaceLabelSerializer,
)
class GeoWardView(_GeoView):
    def get(self, request, slug):
        ward = ward_by_slug(slug)
        if ward is None or ward.parent is None:
            raise Http404
        return Response(GeoPlaceLabelSerializer(_ward_label(ward)).data)
