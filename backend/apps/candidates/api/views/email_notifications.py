from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCandidate

from ...selectors import candidate_email_notification_settings_for_user
from ...services import patch_candidate_email_notification_settings
from ..serializers import CandidateEmailNotificationSettingsSerializer


@extend_schema_view(
    get=extend_schema(
        summary='Đọc cài đặt thông báo email của tôi',
        responses={200: CandidateEmailNotificationSettingsSerializer},
    ),
    patch=extend_schema(
        summary='Cập nhật cài đặt thông báo email của tôi',
        request=CandidateEmailNotificationSettingsSerializer,
        responses={200: CandidateEmailNotificationSettingsSerializer},
    ),
)
@extend_schema(tags=['candidate'])
class MyCandidateEmailNotificationSettingsView(APIView):
    """Read defaults without persistence and create settings on the first patch."""

    permission_classes = [IsCandidate]

    def get(self, request):
        settings = candidate_email_notification_settings_for_user(request.user)
        return Response(CandidateEmailNotificationSettingsSerializer(settings).data)

    def patch(self, request):
        serializer = CandidateEmailNotificationSettingsSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        settings = patch_candidate_email_notification_settings(
            request.user,
            serializer.validated_data,
        )
        return Response(CandidateEmailNotificationSettingsSerializer(settings).data)
