from drf_spectacular.utils import extend_schema, inline_serializer
from django.conf import settings
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.privacy.api.serializers import ConsentSerializer
from apps.privacy.services import build_consent, load_consent, set_consent_cookie


class ConsentView(APIView):
    """Read or replace the signed, first-party consent cookie."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'consent'

    def get_throttles(self):
        # Consent is deliberately editable during local QA. Production still
        # uses the scoped rate limit declared above to protect the endpoint.
        if settings.DEBUG:
            return []
        return super().get_throttles()

    @extend_schema(
        responses=inline_serializer(
            'ConsentState',
            fields={
                'consent': ConsentSerializer(allow_null=True),
            },
        ),
        tags=['privacy'],
    )
    def get(self, request):
        return Response({'consent': load_consent(request)})

    @extend_schema(request=ConsentSerializer, responses=ConsentSerializer, tags=['privacy'])
    def post(self, request):
        serializer = ConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consent = build_consent(**serializer.validated_data)
        response = Response(consent)
        set_consent_cookie(response, consent)

        # Analytics is withdrawn immediately: no future tracking request can
        # reuse an old viewer identifier.
        if not consent['analytics']:
            response.delete_cookie(
                settings.JOB_VIEWER_COOKIE_NAME,
                path='/',
                samesite=settings.JOB_VIEWER_COOKIE_SAMESITE,
            )
        return response
