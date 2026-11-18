from django.db import transaction
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...models import EmployerNotification, EmployerNotificationPreference
from ...selectors import (
    employer_activity_queryset,
    employer_notification_queryset,
    employer_unread_notification_count,
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


class EmployerNotificationPreferenceView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        preference = EmployerNotificationPreference.objects.filter(recipient=request.user).first()
        return Response(_preference_payload(preference))

    def patch(self, request):
        serializer = EmployerNotificationPreferenceSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        preference, _ = EmployerNotificationPreference.objects.update_or_create(
            recipient=request.user, defaults=dict(serializer.validated_data)
        )
        return Response(_preference_payload(preference))


class EmployerNotificationListView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerNotificationSerializer

    def get_queryset(self):
        return employer_notification_queryset(self.request.user)


class EmployerNotificationUnreadCountView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        return Response({'count': employer_unread_notification_count(request.user)})


class EmployerNotificationReadView(APIView):
    permission_classes = [IsEmployer]

    @transaction.atomic
    def post(self, request, public_id):
        notification = (
            EmployerNotification.objects.select_for_update()
            .filter(recipient=request.user, public_id=public_id)
            .first()
        )
        if notification is None:
            return Response({'detail': 'Không tìm thấy thông báo.'}, status=404)
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=['read_at'])
        return Response(EmployerNotificationSerializer(notification).data)


class EmployerNotificationReadAllView(APIView):
    permission_classes = [IsEmployer]

    def post(self, request):
        updated = EmployerNotification.objects.filter(
            recipient=request.user,
            read_at__isnull=True,
        ).update(read_at=timezone.now())
        return Response({'updated': updated})


class EmployerActivityListView(generics.ListAPIView):
    permission_classes = [IsEmployer]
    serializer_class = EmployerActivitySerializer

    def get_queryset(self):
        return employer_activity_queryset(self.request.user)
