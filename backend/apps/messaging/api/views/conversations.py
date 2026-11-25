"""ProCV Connect qua REST, dùng chung cho hai cổng; ``role`` gắn khi khai URL."""

from django.http import FileResponse, Http404
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.employers.services import ensure_recruiter_candidate_data_access
from common.api.pagination import StandardPagination
from common.api.params import parse_bool
from common.api.throttling import WriteScopedRateThrottle, with_account_write_cap

from ...domain import Role
from ...selectors import (
    conversation_for,
    conversations_for,
    current_applications,
    message_for,
    messages_page,
    unread_conversation_count,
)
from ...services import (
    candidate_limit_remaining,
    lock_reason,
    mark_read,
    open_message_file,
    present_conversation,
    present_message,
    send_attachment,
    send_message,
    start_candidate_conversation,
    start_recruiter_conversation,
)
from ..serializers import (
    ConversationQuerySerializer,
    MessagesQuerySerializer,
    ReadSerializer,
    SendFileSerializer,
    SendMessageSerializer,
    StartCandidateConversationSerializer,
    StartRecruiterConversationSerializer,
)

PAGE_SIZE = 20


# Khai ở urls: ``View.as_view(role=Role.X, permission_classes=[...])``. Không dùng
# docstring: drf-spectacular sẽ đưa ghi chú nội bộ vào mô tả API công khai.
class PortalView(APIView):
    role = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Phía NTD mọi thao tác (đọc lẫn gửi) đều chạm dữ liệu ứng viên: kiểm cổng
        # xác thực + DPA ở mỗi request, không chỉ lúc mở hội thoại.
        if self.role == Role.RECRUITER:
            ensure_recruiter_candidate_data_access(request.user)


def present_conversations(rows, role, *, detail=False):
    applications = current_applications(rows)
    results = []
    for conversation in rows:
        application = applications.get((conversation.job_id, conversation.candidate_id))
        visible = (
            application.candidate_visible_status(application.status_history.all())
            if application is not None and role == Role.CANDIDATE
            else None
        )
        results.append(
            present_conversation(
                conversation,
                role,
                application=application,
                visible_status=visible,
                lock=lock_reason(
                    conversation,
                    role,
                    application=application,
                    blocked=getattr(conversation, 'is_blocked', None),
                ),
                limit_remaining=candidate_limit_remaining(conversation, role) if detail else None,
            )
        )
    return results


def get_conversation(request, role, public_id):
    conversation = conversation_for(request.user, role, public_id)
    if conversation is None:
        raise Http404
    return conversation


class _ListSchema(AutoSchema):
    """GET danh sách đặt tên ``*_list`` để không trùng thao tác xem một hội thoại."""

    def _is_list_view(self, serializer=None):
        return self.method == 'GET'


@extend_schema(tags=['messaging'])
class ConversationListCreateView(PortalView):
    schema = _ListSchema()
    throttle_classes = with_account_write_cap(WriteScopedRateThrottle)
    throttle_scope = 'chat_conversation_start'

    @extend_schema(
        summary='Danh sách hội thoại ProCV Connect, mới nhất trước',
        parameters=[ConversationQuerySerializer],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        query = ConversationQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        paginator = StandardPagination()
        paginator.page_size = PAGE_SIZE
        rows = paginator.paginate_queryset(
            conversations_for(request.user, self.role, query=query.validated_data.get('q', '')),
            request,
            view=self,
        )
        return paginator.get_paginated_response(present_conversations(rows, self.role))

    @extend_schema(
        summary='Mở (hoặc lấy lại) hội thoại về một tin tuyển dụng',
        request=OpenApiTypes.OBJECT,
        responses={200: OpenApiTypes.OBJECT, 201: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        if self.role == Role.CANDIDATE:
            serializer = StartCandidateConversationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            conversation, created = start_candidate_conversation(
                request.user, serializer.validated_data['job']
            )
        else:
            serializer = StartRecruiterConversationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            conversation, created = start_recruiter_conversation(
                request.user,
                application_public_id=serializer.validated_data.get('application', ''),
                invitation_public_id=serializer.validated_data.get('invitation', ''),
            )
        conversation = get_conversation(request, self.role, conversation.public_id)
        return Response(
            present_conversations([conversation], self.role, detail=True)[0],
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(
    tags=['messaging'],
    summary='Số hội thoại có tin chưa đọc (badge)',
    responses={200: OpenApiTypes.OBJECT},
)
class ConversationUnreadCountView(PortalView):
    def get(self, request):
        return Response({'count': unread_conversation_count(request.user, self.role)})


@extend_schema(
    tags=['messaging'],
    summary='Một hội thoại: ngữ cảnh tin, hồ sơ, quyền gửi',
    responses={200: OpenApiTypes.OBJECT},
)
class ConversationDetailView(PortalView):
    def get(self, request, public_id):
        conversation = get_conversation(request, self.role, public_id)
        return Response(present_conversations([conversation], self.role, detail=True)[0])


@extend_schema(tags=['messaging'])
class ConversationMessageListCreateView(PortalView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    throttle_classes = with_account_write_cap(WriteScopedRateThrottle)
    throttle_scope = 'chat_message_send'

    @extend_schema(
        summary='Tin nhắn theo seq: trang cũ hơn (before) hoặc bù tin (after)',
        parameters=[MessagesQuerySerializer],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request, public_id):
        conversation = get_conversation(request, self.role, public_id)
        query = MessagesQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        rows, has_more = messages_page(
            conversation,
            before=query.validated_data.get('before'),
            after=query.validated_data.get('after'),
            limit=query.validated_data['limit'],
        )
        return Response(
            {'results': [present_message(row, self.role) for row in rows], 'has_more': has_more}
        )

    @extend_schema(
        summary='Gửi tin: chữ/emoji, thẻ tin (NTD), CV (ứng viên) hoặc tệp (multipart)',
        request={
            'application/json': SendMessageSerializer,
            'multipart/form-data': SendFileSerializer,
        },
        responses={200: OpenApiTypes.OBJECT, 201: OpenApiTypes.OBJECT},
    )
    def post(self, request, public_id):
        if 'file' in request.FILES:
            serializer = SendFileSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            message, created = send_attachment(
                request.user,
                self.role,
                public_id,
                client_id=serializer.validated_data.get('client_id'),
                upload=serializer.validated_data['file'],
            )
        else:
            serializer = SendMessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            message, created = send_message(
                request.user,
                self.role,
                public_id,
                client_id=data.get('client_id'),
                kind=data['kind'],
                body=data.get('body', ''),
                job=data.get('job', ''),
                cv=data.get('cv', ''),
            )
        return Response(
            present_message(message, self.role),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(
    tags=['messaging'],
    summary='Đánh dấu đã đọc tới seq',
    request=ReadSerializer,
    responses={204: None},
)
class ConversationReadView(PortalView):
    def post(self, request, public_id):
        conversation = get_conversation(request, self.role, public_id)
        serializer = ReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mark_read(conversation, self.role, serializer.validated_data['seq'])
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=['messaging'],
    summary='Tệp, ảnh hoặc CV dạng tệp của một tin; ?download=1 để tải về',
    responses={(200, 'application/octet-stream'): OpenApiTypes.BINARY},
)
class ConversationMessageFileView(PortalView):
    def get(self, request, public_id, message_id):
        conversation = get_conversation(request, self.role, public_id)
        message = message_for(conversation, message_id)
        if message is None:
            raise Http404
        stream, content_type, filename = open_message_file(
            message, self.role, viewer=request.user, request=request
        )
        response = FileResponse(
            stream,
            as_attachment=parse_bool(request.query_params.get('download'), False),
            filename=filename,
            content_type=content_type,
        )
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
