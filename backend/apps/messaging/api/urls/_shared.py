"""Route dùng chung của hai cổng; mỗi cổng gắn vai và quyền riêng."""

from django.urls import path

from ..views.conversations import (
    ConversationBlockView,
    ConversationClearView,
    ConversationDetailView,
    ConversationListCreateView,
    ConversationMessageFileView,
    ConversationMessageListCreateView,
    ConversationReadView,
    ConversationUnreadCountView,
)


def conversation_routes(portal, role, permission):
    def view(view_class):
        return view_class.as_view(role=role, permission_classes=[permission])

    return [
        path(
            'conversations/',
            view(ConversationListCreateView),
            name=f'{portal}-conversation-list',
        ),
        path(
            'conversations/unread-count/',
            view(ConversationUnreadCountView),
            name=f'{portal}-conversation-unread-count',
        ),
        path(
            'conversations/<str:public_id>/',
            view(ConversationDetailView),
            name=f'{portal}-conversation-detail',
        ),
        path(
            'conversations/<str:public_id>/messages/',
            view(ConversationMessageListCreateView),
            name=f'{portal}-conversation-messages',
        ),
        path(
            'conversations/<str:public_id>/read/',
            view(ConversationReadView),
            name=f'{portal}-conversation-read',
        ),
        path(
            'conversations/<str:public_id>/clear/',
            view(ConversationClearView),
            name=f'{portal}-conversation-clear',
        ),
        path(
            'conversations/<str:public_id>/block/',
            view(ConversationBlockView),
            name=f'{portal}-conversation-block',
        ),
        path(
            'conversations/<str:public_id>/messages/<str:message_id>/file/',
            view(ConversationMessageFileView),
            name=f'{portal}-conversation-message-file',
        ),
    ]
