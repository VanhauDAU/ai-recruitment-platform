from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from common.pagination import StandardPagination

from ...selectors import (
    active_announcements_for_request,
    admin_announcement_detail_queryset,
    admin_announcements_queryset,
)
from ...services import (
    StaleAnnouncementRevision,
    archive_announcement,
    create_announcement,
    create_announcement_revision,
    duplicate_announcement,
    pause_announcement,
    publish_announcement,
    rename_announcement,
    resume_announcement,
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
    AnnouncementRenameSerializer,
    AnnouncementRevisionCreateSerializer,
)


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
        AdminAnnouncementDetailSerializer(refreshed, context={'request': request}).data,
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
        announcements, next_transition_at = active_announcements_for_request(
            surface=params['surface'],
            path=params['path'],
            user=request.user,
        )
        response = Response(
            {
                'items': ActiveAnnouncementSerializer(
                    announcements,
                    many=True,
                    context={'locale': params['locale']},
                ).data,
                'next_transition_at': next_transition_at,
            }
        )
        response['Cache-Control'] = 'private, no-store'
        return response


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
                context={'request': request},
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
