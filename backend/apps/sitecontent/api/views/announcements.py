from datetime import timedelta
from time import monotonic
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from apps.privacy.services import load_consent
from common.metrics import record_metric
from common.pagination import StandardPagination

from ...models import Announcement, AnnouncementRevision
from ...selectors import (
    active_announcements_for_request,
    admin_announcement_detail_queryset,
    admin_announcements_queryset,
    announcement_audit_events,
    announcement_metrics,
    remote_announcements_enabled,
)
from ...services import (
    StaleAnnouncementRevision,
    StaleAnnouncementState,
    archive_announcement,
    create_announcement,
    create_announcement_revision,
    duplicate_announcement,
    pause_announcement,
    publish_announcement,
    record_consented_announcement_events,
    rename_announcement,
    reset_announcement_dismissals,
    resume_announcement,
    set_announcement_user_state,
    set_announcement_viewer_cookie,
)
from ..serializers import (
    ActiveAnnouncementFeedSerializer,
    ActiveAnnouncementQuerySerializer,
    ActiveAnnouncementSerializer,
    AdminAnnouncementDetailSerializer,
    AdminAnnouncementListSerializer,
    AnnouncementActionSerializer,
    AnnouncementCreateSerializer,
    AnnouncementDuplicateSerializer,
    AnnouncementEventBatchSerializer,
    AnnouncementMetricQuerySerializer,
    AnnouncementMetricReportSerializer,
    AnnouncementRenameSerializer,
    AnnouncementRevisionCreateSerializer,
    AnnouncementRuntimeEventSerializer,
    AnnouncementStateWriteSerializer,
    AnnouncementUserStateSerializer,
)


class FailOpenAnnouncementThrottle(ScopedRateThrottle):
    """Keep best-effort announcement telemetry available when Redis is down."""

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            record_metric(
                'announcement_throttle',
                event='fail_open',
                reason='cache_error',
                scope=getattr(view, 'throttle_scope', 'unknown'),
            )
            return True


def _validation_detail(error):
    return getattr(error, 'message_dict', {'detail': error.messages})


def _run_mutation(operation):
    try:
        return operation()
    except StaleAnnouncementRevision as error:
        return Response(
            {
                'code': 'announcement_revision_stale',
                'detail': (
                    'Thông báo đã được thay đổi. Hãy tải lại và kiểm tra trước khi tiếp tục.'
                ),
                'current_revision_token': error.current_revision_token,
            },
            status=status.HTTP_409_CONFLICT,
        )
    except DjangoValidationError as error:
        raise ValidationError(_validation_detail(error)) from error


def _announcement(request, public_id):
    return get_object_or_404(
        admin_announcement_detail_queryset(),
        public_id=public_id,
    )


def _detail_response(request, announcement, *, response_status=status.HTTP_200_OK):
    refreshed = _announcement(request, announcement.public_id)
    return Response(
        AdminAnnouncementDetailSerializer(
            refreshed,
            context={
                'request': request,
                'audit_events': announcement_audit_events(refreshed.public_id),
            },
        ).data,
        status=response_status,
    )


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
        try:
            state = set_announcement_user_state(
                announcement=announcement,
                user=request.user,
                revision_number=serializer.validated_data['revision'],
                dismissal_version=serializer.validated_data['dismissal_version'],
                action=serializer.validated_data['action'],
            )
        except StaleAnnouncementState as error:
            return Response(
                {
                    'code': 'announcement_state_stale',
                    'detail': 'Thông báo đã thay đổi. Hãy tải lại feed trước khi thao tác.',
                    'current_revision': error.current_revision,
                    'current_dismissal_version': error.current_dismissal_version,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            raise ValidationError(_validation_detail(error)) from error
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

        public_ids = {event['public_id'] for event in events}
        revisions = AnnouncementRevision.objects.filter(
            announcement__public_id__in=public_ids,
            published_at__isnull=False,
        ).select_related('announcement')
        revisions_by_key = {
            (revision.announcement.public_id, revision.number): revision for revision in revisions
        }
        valid_events = []
        for event in events:
            revision = revisions_by_key.get((event['public_id'], event['revision']))
            if revision is None or event['surface'] not in revision.surfaces:
                record_metric(
                    'announcement_analytics',
                    event=event['event'],
                    reason='invalid_event',
                    surface=event['surface'],
                )
                continue
            valid_events.append({**event, 'revision_object': revision})

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


@extend_schema_view(
    get=extend_schema(
        summary='Admin: danh sách thông báo',
        responses={200: AdminAnnouncementListSerializer(many=True)},
        tags=['site-announcements-admin'],
    ),
    post=extend_schema(
        summary='Admin: tạo thông báo và revision đầu tiên',
        request=AnnouncementCreateSerializer,
        responses={201: AdminAnnouncementDetailSerializer},
        tags=['site-announcements-admin'],
    ),
)
class AdminAnnouncementListCreateView(generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['announcement.view'],
        'POST': ['announcement.view', 'announcement.manage'],
    }
    pagination_class = StandardPagination

    def get_queryset(self):
        return admin_announcements_queryset(self.request.query_params)

    def get_serializer_class(self):
        return AdminAnnouncementListSerializer

    def post(self, request):
        serializer = AnnouncementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: create_announcement(
                actor=request.user,
                internal_name=serializer.validated_data['internal_name'],
                revision_data=serializer.validated_data['revision'],
            )
        )
        if isinstance(result, Response):
            return result
        return _detail_response(request, result, response_status=status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(
        summary='Admin: chi tiết và lịch sử revision thông báo',
        responses={200: AdminAnnouncementDetailSerializer},
        tags=['site-announcements-admin'],
    ),
    patch=extend_schema(
        summary='Admin: đổi tên vận hành với optimistic locking',
        request=AnnouncementRenameSerializer,
        responses={200: AdminAnnouncementDetailSerializer, 409: OpenApiResponse()},
        tags=['site-announcements-admin'],
    ),
)
class AdminAnnouncementDetailView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['announcement.view'],
        'PATCH': ['announcement.view', 'announcement.manage'],
    }

    def get(self, request, public_id):
        announcement = _announcement(request, public_id)
        return Response(
            AdminAnnouncementDetailSerializer(
                announcement,
                context={
                    'request': request,
                    'audit_events': announcement_audit_events(announcement.public_id),
                },
            ).data
        )

    def patch(self, request, public_id):
        announcement = _announcement(request, public_id)
        serializer = AnnouncementRenameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: rename_announcement(
                announcement=announcement,
                actor=request.user,
                internal_name=serializer.validated_data['internal_name'],
                expected_revision_token=serializer.validated_data['revision_token'],
            )
        )
        if isinstance(result, Response):
            return result
        return _detail_response(request, result)


@extend_schema(
    summary='Admin: tạo immutable announcement revision',
    request=AnnouncementRevisionCreateSerializer,
    responses={201: AdminAnnouncementDetailSerializer, 409: OpenApiResponse()},
    tags=['site-announcements-admin'],
)
class AdminAnnouncementRevisionCreateView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['announcement.view', 'announcement.manage']}

    def post(self, request, public_id):
        announcement = _announcement(request, public_id)
        serializer = AnnouncementRevisionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: create_announcement_revision(
                announcement=announcement,
                actor=request.user,
                revision_data=serializer.validated_data['revision'],
                expected_revision_token=serializer.validated_data['revision_token'],
            )
        )
        if isinstance(result, Response):
            return result
        updated, _ = result
        return _detail_response(request, updated, response_status=status.HTTP_201_CREATED)


class AdminAnnouncementActionView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['announcement.view', 'announcement.publish']}
    announcement_action = None

    @extend_schema(
        request=AnnouncementActionSerializer,
        responses={200: AdminAnnouncementDetailSerializer, 409: OpenApiResponse()},
        tags=['site-announcements-admin'],
    )
    def post(self, request, public_id):
        announcement = _announcement(request, public_id)
        serializer = AnnouncementActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        operations = {
            'publish': lambda: publish_announcement(
                announcement=announcement,
                actor=request.user,
                revision_number=validated.get('revision'),
                expected_revision_token=validated['revision_token'],
            ),
            'pause': lambda: pause_announcement(
                announcement=announcement,
                actor=request.user,
                expected_revision_token=validated['revision_token'],
            ),
            'resume': lambda: resume_announcement(
                announcement=announcement,
                actor=request.user,
                expected_revision_token=validated['revision_token'],
            ),
            'archive': lambda: archive_announcement(
                announcement=announcement,
                actor=request.user,
                expected_revision_token=validated['revision_token'],
            ),
            'reset-dismissals': lambda: reset_announcement_dismissals(
                announcement=announcement,
                actor=request.user,
                expected_revision_token=validated['revision_token'],
            ),
        }
        if self.announcement_action == 'publish' and 'revision' not in validated:
            raise ValidationError({'revision': 'Chọn revision cần phát hành.'})
        result = _run_mutation(operations[self.announcement_action])
        if isinstance(result, Response):
            return result
        return _detail_response(request, result)


class AdminAnnouncementPublishView(AdminAnnouncementActionView):
    announcement_action = 'publish'


class AdminAnnouncementPauseView(AdminAnnouncementActionView):
    announcement_action = 'pause'


class AdminAnnouncementResumeView(AdminAnnouncementActionView):
    announcement_action = 'resume'


class AdminAnnouncementArchiveView(AdminAnnouncementActionView):
    announcement_action = 'archive'


class AdminAnnouncementResetDismissalsView(AdminAnnouncementActionView):
    announcement_action = 'reset-dismissals'


@extend_schema(
    summary='Admin: nhân bản thông báo thành draft mới',
    request=AnnouncementDuplicateSerializer,
    responses={201: AdminAnnouncementDetailSerializer, 409: OpenApiResponse()},
    tags=['site-announcements-admin'],
)
class AdminAnnouncementDuplicateView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['announcement.view', 'announcement.manage']}

    def post(self, request, public_id):
        announcement = _announcement(request, public_id)
        serializer = AnnouncementDuplicateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: duplicate_announcement(
                announcement=announcement,
                actor=request.user,
                internal_name=serializer.validated_data['internal_name'],
                expected_revision_token=serializer.validated_data['revision_token'],
            )
        )
        if isinstance(result, Response):
            return result
        return _detail_response(request, result, response_status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Admin: daily metrics thông báo theo toàn bộ revision',
    parameters=[AnnouncementMetricQuerySerializer],
    responses={200: AnnouncementMetricReportSerializer},
    tags=['site-announcements-admin'],
)
class AdminAnnouncementMetricView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['announcement.view']}

    def get(self, request, public_id):
        announcement = get_object_or_404(Announcement, public_id=public_id)
        query = AnnouncementMetricQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        today = timezone.localdate(timezone=ZoneInfo('Asia/Ho_Chi_Minh'))
        date_to = query.validated_data.get('date_to', today)
        date_from = query.validated_data.get('date_from', date_to - timedelta(days=29))
        if date_from > date_to:
            raise ValidationError({'date_to': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'})
        if (date_to - date_from).days > 92:
            raise ValidationError({'date_to': 'Khoảng báo cáo tối đa là 93 ngày.'})

        daily = announcement_metrics(
            announcement=announcement,
            date_from=date_from,
            date_to=date_to,
        )
        summary = {
            field: sum(row[field] for row in daily)
            for field in (
                'impressions',
                'unique_impressions',
                'clicks',
                'unique_clicks',
                'dismisses',
            )
        }

        def rates(item):
            impressions = item['impressions']
            return {
                **item,
                'ctr': round(item['clicks'] * 100 / impressions, 2) if impressions else 0.0,
                'dismiss_rate': (
                    round(item['dismisses'] * 100 / impressions, 2) if impressions else 0.0
                ),
            }

        payload = {
            'public_id': announcement.public_id,
            'date_from': date_from,
            'date_to': date_to,
            'consent_notice': (
                'Số liệu chỉ gồm người dùng đã bật Analytics và không đại diện toàn bộ lượt xem.'
            ),
            'summary': rates(summary),
            'daily': [rates(row) for row in daily],
        }
        return Response(AnnouncementMetricReportSerializer(payload).data)
