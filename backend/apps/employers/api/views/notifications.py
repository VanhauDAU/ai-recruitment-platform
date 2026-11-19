from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer

from ...selectors import (
    employer_activity_queryset,
    employer_notification_preference,
    employer_notification_queryset,
    employer_unread_notification_count,
)
from ...services import (
    mark_all_employer_notifications_read,
    mark_employer_notification_read,
    update_employer_notification_preference,
)
from ..serializers import (
    EmployerActivitySerializer,
    EmployerNotificationPreferenceSerializer,
    EmployerNotificationSerializer,
)


def _preference_payload(preference):
    return {
        'important_decision_email': True,
        'intermediate_verification_email': (
            preference.intermediate_verification_email if preference else True
        ),
        'new_application_email': preference.new_application_email if preference else True,
        'campaign_weekly_report_email': (
            preference.campaign_weekly_report_email if preference else True
        ),
    }


@extend_schema(tags=['employer'])
class EmployerNotificationPreferenceView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Cài đặt email thông báo của nhà tuyển dụng',
        responses={200: EmployerNotificationPreferenceSerializer},
    )
    def get(self, request):
        return Response(_preference_payload(employer_notification_preference(request.user)))

    @extend_schema(
        summary='Bật/tắt các email thông báo không bắt buộc',
        request=EmployerNotificationPreferenceSerializer,
        responses={200: EmployerNotificationPreferenceSerializer},
    )
    def patch(self, request):
        serializer = EmployerNotificationPreferenceSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        preference = update_employer_notification_preference(
            request.user, serializer.validated_data
        )
        return Response(_preference_payload(preference))


@extend_schema_view(get=extend_schema(summary='Thông báo của nhà tuyển dụng', tags=['employer']))
class EmployerNotificationListView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerNotificationSerializer

    def get_queryset(self):
        return employer_notification_queryset(self.request.user)


class EmployerNotificationUnreadCountView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Số thông báo chưa đọc',
        responses=inline_serializer(
            'EmployerNotificationUnreadCount', fields={'count': serializers.IntegerField()}
        ),
        tags=['employer'],
    )
    def get(self, request):
        return Response({'count': employer_unread_notification_count(request.user)})


class EmployerNotificationReadView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Đánh dấu một thông báo đã đọc',
        request=None,
        responses={200: EmployerNotificationSerializer},
        tags=['employer'],
    )
    def post(self, request, public_id):
        notification = mark_employer_notification_read(request.user, public_id)
        if notification is None:
            raise NotFound(_('Không tìm thấy thông báo.'))
        return Response(EmployerNotificationSerializer(notification).data)


class EmployerNotificationReadAllView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Đánh dấu mọi thông báo đã đọc',
        request=None,
        responses=inline_serializer(
            'EmployerNotificationReadAll', fields={'updated': serializers.IntegerField()}
        ),
        tags=['employer'],
    )
    def post(self, request):
        return Response({'updated': mark_all_employer_notifications_read(request.user)})


@extend_schema_view(get=extend_schema(summary='Nhật ký hoạt động của tôi', tags=['employer']))
class EmployerActivityListView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerActivitySerializer

    def get_queryset(self):
        return employer_activity_queryset(self.request.user)
