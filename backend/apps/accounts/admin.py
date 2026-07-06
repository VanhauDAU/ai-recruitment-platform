from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ['email']
    list_display = ['email', 'full_name', 'role', 'status', 'is_staff', 'created_at_display']
    list_filter = ['role', 'status', 'is_staff']
    search_fields = ['email', 'full_name']
    readonly_fields = ['public_id', 'date_joined', 'last_login', 'updated_at']
    fieldsets = (
        (None, {'fields': ('email', 'password', 'public_id')}),
        ('Profile', {'fields': ('full_name', 'phone', 'avatar_url')}),
        ('Role & status', {'fields': ('role', 'status', 'is_active', 'is_staff', 'is_superuser', 'email_verified')}),
        ('OAuth', {'fields': ('provider', 'provider_id')}),
        ('Soft delete', {'fields': ('is_deleted', 'deleted_at')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('date_joined', 'last_login', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'role', 'password1', 'password2'),
        }),
    )

    @admin.display(description='Created at')
    def created_at_display(self, obj):
        return obj.date_joined
