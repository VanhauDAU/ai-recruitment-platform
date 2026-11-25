from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ...services import issue_ticket


@extend_schema(
    tags=['realtime'],
    summary='Cấp vé kết nối WebSocket thông báo (dùng một lần, 30 giây)',
    request=None,
    responses={
        200: inline_serializer(
            'RealtimeTicket',
            {'ticket': serializers.CharField(), 'expires_in': serializers.IntegerField()},
        )
    },
)
class RealtimeTicketView(APIView):
    """Any signed-in portal account; the JWT authentication already enforced its session."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_ticket'

    def post(self, request):
        return Response(issue_ticket(user=request.user, validated_token=request.auth))
