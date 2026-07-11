from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import SocialAccount, User


class SocialAccountInline(admin.TabularInline):
    model = SocialAccount
    extra = 0
    can_delete = False
    readonly_fields = ['provider', 'provider_user_id', 'email', 'created_at', 'updated_at']


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
        ('Soft delete', {'fields': ('is_deleted', 'deleted_at')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('date_joined', 'last_login', 'updated_at')}),
    )

    filter_horizontal = ('groups', 'user_permissions')
    inlines = [SocialAccountInline]
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'role', 'password1', 'password2'),
        }),
    )

    @admin.display(description='Created at')
    def created_at_display(self, obj):
        return obj.date_joined
