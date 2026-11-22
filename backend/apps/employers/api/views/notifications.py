from django.utils.translation import gettext as _
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer
from common.api.params import parse_bool

from ...selectors import (
    EMPLOYER_ACTIVITY_PERIOD_DAYS,
    EMPLOYER_EVENT_CATEGORY_KEYS,
    employer_activity_category_counts,
    employer_activity_daily_counts,
    employer_activity_queryset,
    employer_notification_preference,
    employer_notification_queryset,
    employer_notification_unread_counts,
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


CATEGORY_PARAMETER = OpenApiParameter('category', str, enum=list(EMPLOYER_EVENT_CATEGORY_KEYS))


@extend_schema_view(
    get=extend_schema(
        summary='Thông báo của nhà tuyển dụng (kèm unread_counts khi phân trang)',
        parameters=[CATEGORY_PARAMETER, OpenApiParameter('unread', bool)],
        tags=['employer'],
    )
)
class EmployerNotificationListView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerNotificationSerializer

    def get_queryset(self):
        return employer_notification_queryset(
            self.request.user,
            category=self.request.query_params.get('category'),
            unread=parse_bool(self.request.query_params.get('unread')),
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Unread count of every category tab, whichever tab is open.
        if isinstance(response.data, dict):
            response.data['unread_counts'] = employer_notification_unread_counts(request.user)
        return response


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


@extend_schema_view(
    get=extend_schema(
        summary='Nhật ký hoạt động của tôi (kèm category_counts, daily_counts khi phân trang)',
        parameters=[
            CATEGORY_PARAMETER,
            OpenApiParameter(
                'days',
                int,
                enum=list(EMPLOYER_ACTIVITY_PERIOD_DAYS),
                description='Chỉ lấy hoạt động trong N ngày gần nhất',
            ),
        ],
        tags=['employer'],
    )
)
class EmployerActivityListView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerActivitySerializer

    def _days(self):
        value = self.request.query_params.get('days')
        return int(value) if value and value.isdigit() else None

    def get_queryset(self):
        return employer_activity_queryset(
            self.request.user,
            category=self.request.query_params.get('category'),
            days=self._days(),
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Tab counts follow the period but not the open tab.
        if isinstance(response.data, dict):
            response.data['category_counts'] = employer_activity_category_counts(
                request.user, days=self._days()
            )
            # Chart of the last 14 days for the open tab, independent of the period.
            response.data['daily_counts'] = employer_activity_daily_counts(
                request.user, category=request.query_params.get('category')
            )
        return response
