"""Admin portal endpoints for authoring and measuring announcements."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission
from common.vietnam_time import vietnam_today

from ...models import Announcement
from ...selectors import (
    admin_announcement_detail_queryset,
    admin_announcements_queryset,
    announcement_audit_events,
    announcement_metrics,
)
from ...services import (
    archive_announcement,
    create_announcement,
    create_announcement_revision,
    duplicate_announcement,
    pause_announcement,
    publish_announcement,
    rename_announcement,
    reset_announcement_dismissals,
    resume_announcement,
    upload_announcement_background,
)
from ..serializers import (
    AdminAnnouncementDetailSerializer,
    AdminAnnouncementListSerializer,
    AnnouncementActionSerializer,
    AnnouncementCreateSerializer,
    AnnouncementDuplicateSerializer,
    AnnouncementMetricQuerySerializer,
    AnnouncementMetricReportSerializer,
    AnnouncementRenameSerializer,
    AnnouncementRevisionCreateSerializer,
)


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
    permission_classes = [AdminPortalPermission]

    def get_queryset(self):
        return admin_announcements_queryset(self.request.query_params)

    def get_serializer_class(self):
        return AdminAnnouncementListSerializer

    def post(self, request):
        serializer = AnnouncementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = create_announcement(
            actor=request.user,
            internal_name=serializer.validated_data['internal_name'],
            revision_data=serializer.validated_data['revision'],
        )
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
    permission_classes = [AdminPortalPermission]

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
        result = rename_announcement(
            announcement=announcement,
            actor=request.user,
            internal_name=serializer.validated_data['internal_name'],
            expected_revision_token=serializer.validated_data['revision_token'],
        )
        return _detail_response(request, result)


@extend_schema(
    summary='Admin: tạo immutable announcement revision',
    request=AnnouncementRevisionCreateSerializer,
    responses={201: AdminAnnouncementDetailSerializer, 409: OpenApiResponse()},
    tags=['site-announcements-admin'],
)
class AdminAnnouncementRevisionCreateView(APIView):
    permission_classes = [AdminPortalPermission]

    def post(self, request, public_id):
        announcement = _announcement(request, public_id)
        serializer = AnnouncementRevisionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = create_announcement_revision(
            announcement=announcement,
            actor=request.user,
            revision_data=serializer.validated_data['revision'],
            expected_revision_token=serializer.validated_data['revision_token'],
        )
        updated, _ = result
        return _detail_response(request, updated, response_status=status.HTTP_201_CREATED)


class AdminAnnouncementActionView(APIView):
    permission_classes = [AdminPortalPermission]
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
        result = operations[self.announcement_action]()
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
    permission_classes = [AdminPortalPermission]

    def post(self, request, public_id):
        announcement = _announcement(request, public_id)
        serializer = AnnouncementDuplicateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = duplicate_announcement(
            announcement=announcement,
            actor=request.user,
            internal_name=serializer.validated_data['internal_name'],
            expected_revision_token=serializer.validated_data['revision_token'],
        )
        return _detail_response(request, result, response_status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Admin: daily metrics thông báo theo toàn bộ revision',
    parameters=[AnnouncementMetricQuerySerializer],
    responses={200: AnnouncementMetricReportSerializer},
    tags=['site-announcements-admin'],
)
class AdminAnnouncementMetricView(APIView):
    permission_classes = [AdminPortalPermission]

    def get(self, request, public_id):
        announcement = get_object_or_404(Announcement, public_id=public_id)
        query = AnnouncementMetricQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        today = vietnam_today()
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


@extend_schema(
    summary='Admin: upload ảnh nền dải thông báo',
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {'file': {'type': 'string', 'format': 'binary'}},
            'required': ['file'],
        }
    },
    responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
    tags=['site-announcements-admin'],
)
class AdminAnnouncementBackgroundUploadView(APIView):
    """Upload ảnh nền strip (JPEG/PNG/WebP, ngang hẹp, ≤1 MB)."""

    permission_classes = [AdminPortalPermission]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('image')
        saved = upload_announcement_background(upload=upload, request=request)
        return Response(saved, status=status.HTTP_201_CREATED)
