from django.contrib import admin
from chat.models import Conversation, ConversationParticipant, Message


class ConversationParticipantInline(admin.TabularInline):
    model = ConversationParticipant
    extra = 1


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'updated_at')
    inlines = [ConversationParticipantInline, MessageInline]
    search_fields = ('id',)


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'user', 'joined_at')
    list_filter = ('joined_at',)
    search_fields = ('user__email', 'user__name', 'conversation__id')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'sender', 'content_preview', 'is_read', 'is_deleted', 'created_at')
    list_filter = ('is_read', 'is_deleted', 'created_at')
    search_fields = ('content', 'sender__email', 'conversation__id')

    def content_preview(self, obj):
        return obj.content[:50] + ('...' if len(obj.content) > 50 else '')
    content_preview.short_description = 'Content'
