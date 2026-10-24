from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from users.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['email']
    list_display = ['email', 'name', 'is_staff', 'is_active', 'last_seen', 'created_at']
    list_filter = ['is_staff', 'is_active', 'created_at']
    search_fields = ['email', 'name']

    fieldsets = [
        (None, {'fields': ['email', 'password']}),
        ('Personal Info', {'fields': ['name', 'profile_image']}),
        ('Permissions', {'fields': ['is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions']}),
        ('Important dates', {'fields': ['last_seen', 'last_login']}),
    ]

    add_fieldsets = [
        (
            None,
            {
                'classes': ['wide'],
                'fields': ['email', 'name', 'password1', 'password2'],
            },
        ),
    ]
