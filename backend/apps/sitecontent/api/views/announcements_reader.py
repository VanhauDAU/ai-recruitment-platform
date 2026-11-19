"""Reader-facing announcement endpoints (public and shared portals)."""

import logging
from time import monotonic

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.privacy.services import load_consent
from common.metrics import record_metric

from ...models import Announcement
from ...selectors import (
    active_announcements_for_request,
    remote_announcements_enabled,
)
from ...services import (
    attach_published_revisions,
    record_consented_announcement_events,
    set_announcement_user_state,
    set_announcement_viewer_cookie,
)
from ..serializers import (
    ActiveAnnouncementFeedSerializer,
    ActiveAnnouncementQuerySerializer,
    ActiveAnnouncementSerializer,
    AnnouncementEventBatchSerializer,
    AnnouncementRuntimeEventSerializer,
    AnnouncementStateWriteSerializer,
    AnnouncementUserStateSerializer,
)

logger = logging.getLogger(__name__)


class FailOpenAnnouncementThrottle(ScopedRateThrottle):
    """Keep best-effort announcement telemetry available when Redis is down."""

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:  # noqa: BLE001 - any cache backend error must fail open here
            logger.warning('Announcement throttle cache unavailable; failing open.')
            record_metric(
                'announcement_throttle',
                event='fail_open',
                reason='cache_error',
                scope=getattr(view, 'throttle_scope', 'unknown'),
            )
            return True


@extend_schema(
    summary='Dải thông báo đang hoạt động theo surface và route',
    parameters=[ActiveAnnouncementQuerySerializer],
    responses={200: ActiveAnnouncementFeedSerializer},
    tags=['site-announcements'],
)
class ActiveAnnouncementListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = ActiveAnnouncementQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        surface = params['surface']
        remote_enabled = remote_announcements_enabled(surface)
        started_at = monotonic()
        try:
            if remote_enabled:
                announcements, next_transition_at = active_announcements_for_request(
                    surface=surface,
                    path=params['path'],
                    user=request.user,
                )
            else:
                announcements, next_transition_at = [], None
        except Exception:
            record_metric(
                'announcement_feed_latency_ms',
                round((monotonic() - started_at) * 1000, 2),
                surface=surface,
                status='error',
            )
            raise
        record_metric(
            'announcement_feed_latency_ms',
            round((monotonic() - started_at) * 1000, 2),
            surface=surface,
            status='served' if remote_enabled else 'disabled',
        )
        response = Response(
            {
                'items': ActiveAnnouncementSerializer(
                    announcements,
                    many=True,
                    context={'locale': params['locale']},
                ).data,
                'next_transition_at': next_transition_at,
                'remote_enabled': remote_enabled,
            }
        )
        response['Cache-Control'] = 'private, no-store'
        return response


@extend_schema(
    summary='Lưu trạng thái dismiss hoặc snooze của người dùng',
    request=AnnouncementStateWriteSerializer,
    responses={200: AnnouncementUserStateSerializer, 409: OpenApiResponse()},
    tags=['site-announcements'],
)
class AnnouncementStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, public_id):
        announcement = get_object_or_404(
            Announcement.objects.select_related('active_revision'),
            public_id=public_id,
        )
        serializer = AnnouncementStateWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = set_announcement_user_state(
            announcement=announcement,
            user=request.user,
            revision_number=serializer.validated_data['revision'],
            dismissal_version=serializer.validated_data['dismissal_version'],
            action=serializer.validated_data['action'],
        )
        return Response(
            AnnouncementUserStateSerializer(
                {
                    'public_id': announcement.public_id,
                    'revision': announcement.active_revision.number,
                    'dismissal_version': state.dismissal_version,
                    'dismissed_at': state.dismissed_at,
                    'snoozed_until': state.snoozed_until,
                }
            ).data
        )


@extend_schema(
    summary='Nhận batch analytics thông báo theo consent',
    request=AnnouncementEventBatchSerializer,
    responses={202: OpenApiResponse(description='Batch được nhận theo cơ chế best-effort.')},
    tags=['site-announcements'],
)
class AnnouncementEventBatchView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [FailOpenAnnouncementThrottle]
    throttle_scope = 'announcement_event'

    def post(self, request):
        serializer = AnnouncementEventBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        events = serializer.validated_data['events']
        record_metric('announcement_event_batch_size', len(events), reason='received')
        consent = load_consent(request)
        if not consent or not consent['analytics']:
            record_metric(
                'announcement_analytics',
                event='batch',
                reason='consent_required',
            )
            return Response({'accepted': True}, status=status.HTTP_202_ACCEPTED)

        valid_events = attach_published_revisions(events)

        response = Response({'accepted': True}, status=status.HTTP_202_ACCEPTED)
        if valid_events:
            result = record_consented_announcement_events(request, valid_events)
            set_announcement_viewer_cookie(response, result.get('viewer_id'))
        return response


@extend_schema(
    summary='Nhận operational event PII-free của runtime thông báo',
    request=AnnouncementRuntimeEventSerializer,
    responses={202: OpenApiResponse(description='Event vận hành được nhận best-effort.')},
    tags=['site-announcements'],
)
class AnnouncementRuntimeEventView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [FailOpenAnnouncementThrottle]
    throttle_scope = 'announcement_runtime'

    def post(self, request):
        serializer = AnnouncementRuntimeEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.validated_data
        record_metric(
            'announcement_runtime',
            event=event['event'],
            reason=event['reason'],
            surface=event['surface'],
        )
        return Response({'accepted': True}, status=status.HTTP_202_ACCEPTED)
