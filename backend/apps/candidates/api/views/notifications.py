from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsCandidate

from ...selectors import candidate_notification_queryset, candidate_unread_notification_count
from ...services import mark_all_candidate_notifications_read, mark_candidate_notification_read
from ..serializers import CandidateNotificationSerializer


@extend_schema(tags=['candidate'], summary='Thông báo của tôi (mới nhất trước)')
class CandidateNotificationListView(generics.ListAPIView):
    permission_classes = [IsCandidate]
    serializer_class = CandidateNotificationSerializer

    def get_queryset(self):
        return candidate_notification_queryset(self.request.user)


@extend_schema(
    tags=['candidate'],
    summary='Số thông báo chưa đọc',
    responses={
        200: inline_serializer('CandidateUnreadCount', {'count': serializers.IntegerField()})
    },
)
class CandidateNotificationUnreadCountView(APIView):
    permission_classes = [IsCandidate]

    def get(self, request):
        return Response({'count': candidate_unread_notification_count(request.user)})


@extend_schema(
    tags=['candidate'],
    summary='Đánh dấu một thông báo đã đọc',
    request=None,
    responses={
        200: CandidateNotificationSerializer,
        404: OpenApiResponse(description='Không tìm thấy'),
    },
)
class CandidateNotificationReadView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request, public_id):
        notification = mark_candidate_notification_read(request.user, public_id)
        if notification is None:
            raise Http404
        return Response(CandidateNotificationSerializer(notification).data)


@extend_schema(
    tags=['candidate'],
    summary='Đánh dấu tất cả thông báo đã đọc',
    request=None,
    responses={200: inline_serializer('CandidateReadAll', {'updated': serializers.IntegerField()})},
)
class CandidateNotificationReadAllView(APIView):
    permission_classes = [IsCandidate]

    def post(self, request):
        return Response({'updated': mark_all_candidate_notifications_read(request.user)})
