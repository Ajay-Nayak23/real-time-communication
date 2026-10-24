from django.urls import path
from chat.views import (
    ConversationDetailView,
    ConversationListCreateView,
    ConversationMessagesView,
)

app_name = 'chat'

urlpatterns = [
    path('conversations/', ConversationListCreateView.as_view(), name='conversation_list_create'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/<int:conversation_id>/messages/', ConversationMessagesView.as_view(), name='conversation_messages'),
    path('chat/conversations/', ConversationListCreateView.as_view(), name='chat_conversation_list_create'),
    path('chat/conversations/<int:pk>/', ConversationDetailView.as_view(), name='chat_conversation_detail'),
    path('chat/conversations/<int:conversation_id>/messages/', ConversationMessagesView.as_view(), name='chat_conversation_messages'),
]
