from django.urls import path
from chat.views import (
    ConversationDetailView,
    ConversationListCreateView,
    ConversationMarkReadView,
    ConversationMessagesView,
)

app_name = 'chat'

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='conversation_list_create'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/<int:conversation_id>/messages/', ConversationMessagesView.as_view(), name='conversation_messages'),
    path('conversations/<int:conversation_id>/read/', ConversationMarkReadView.as_view(), name='conversation_mark_read'),
    path('chat/conversations/', ConversationListCreateView.as_view(), name='chat_conversation_list_create'),
    path('chat/conversations/<int:pk>/', ConversationDetailView.as_view(), name='chat_conversation_detail'),
    path('chat/conversations/<int:conversation_id>/messages/', ConversationMessagesView.as_view(), name='chat_conversation_messages'),
    path('chat/conversations/<int:conversation_id>/read/', ConversationMarkReadView.as_view(), name='chat_conversation_mark_read'),
]

