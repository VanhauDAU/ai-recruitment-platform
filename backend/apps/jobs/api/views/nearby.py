"""Việc làm gần bạn (ADR-0029): list + map of jobs around a candidate-chosen point."""

from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ...selectors.nearby import (
    NEARBY_ORDERINGS,
    build_nearby_markers,
    build_nearby_queryset,
    expand_radius_suggestion,
    nearby_enabled,
    parse_nearby_origin,
)
from ..serializers import NearbyMarkerSerializer, PublicNearbyJobSerializer

NEARBY_PARAMETERS = [
    OpenApiParameter('lat', float, required=True, description='Vĩ độ (làm tròn 3 chữ số)'),
    OpenApiParameter('lng', float, required=True, description='Kinh độ (làm tròn 3 chữ số)'),
    OpenApiParameter('radius_km', int, description='Bán kính, kẹp theo cấu hình (mặc định 10)'),
    OpenApiParameter('include_province_wide', bool, description='Gồm tin tuyển khắp tỉnh'),
    OpenApiParameter('include_remote', bool, description='Gồm tin chỉ làm từ xa'),
]

_ORIGIN_FIELDS = {
    'latitude': serializers.FloatField(),
    'longitude': serializers.FloatField(),
    'radius_km': serializers.IntegerField(),
    'ward': inline_serializer(
        'NearbyOriginPlace',
        fields={
            'id': serializers.IntegerField(),
            'name': serializers.CharField(),
            'slug': serializers.CharField(),
            'province_id': serializers.IntegerField(),
            'province_name': serializers.CharField(),
        },
        allow_null=True,
    ),
}


def _origin_payload(origin):
    ward = origin.ward
    return {
        'latitude': origin.latitude,
        'longitude': origin.longitude,
        'radius_km': origin.radius_km,
        'ward': (
            {
                'id': ward.pk,
                'name': ward.name,
                'slug': ward.slug,
                'province_id': ward.parent.pk,
                'province_name': ward.parent.name,
            }
            if ward and ward.parent
            else None
        ),
    }


class _NearbyMixin:
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'nearby_jobs'

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not nearby_enabled():
            raise Http404
        self.origin = parse_nearby_origin(request.query_params)


@extend_schema(
    tags=['jobs'],
    summary='Việc làm gần một vị trí (sắp theo khoảng cách)',
    parameters=[
        *NEARBY_PARAMETERS,
        OpenApiParameter('ordering', str, enum=sorted(NEARBY_ORDERINGS)),
    ],
)
class NearbyJobListView(_NearbyMixin, generics.ListAPIView):
    serializer_class = PublicNearbyJobSerializer

    def get_queryset(self):
        return build_nearby_queryset(self.request.query_params, self.origin)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data['origin'] = _origin_payload(self.origin)
        response.data['expand_suggestion'] = (
            expand_radius_suggestion(request.query_params, self.origin)
            if response.data.get('count') == 0
            else None
        )
        return response


@extend_schema(
    tags=['jobs'],
    summary='Điểm việc làm trên bản đồ quanh một vị trí',
    parameters=NEARBY_PARAMETERS,
    responses=inline_serializer(
        'NearbyJobMap',
        fields={
            'origin': inline_serializer('NearbyJobMapOrigin', fields=_ORIGIN_FIELDS),
            'points': NearbyMarkerSerializer(many=True),
            'truncated': serializers.BooleanField(),
        },
    ),
)
class NearbyJobMapView(_NearbyMixin, APIView):
    def get(self, request):
        points, truncated = build_nearby_markers(request.query_params, self.origin)
        return Response(
            {
                'origin': _origin_payload(self.origin),
                'points': NearbyMarkerSerializer(
                    points, many=True, context={'request': request}
                ).data,
                'truncated': truncated,
            }
        )
