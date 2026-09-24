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
        (
            'Role & status',
            {
                'fields': (
                    'role',
                    'status',
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'email_verified',
                )
            },
        ),
        ('Soft delete', {'fields': ('is_deleted', 'deleted_at')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('date_joined', 'last_login', 'updated_at')}),
    )

    filter_horizontal = ('groups', 'user_permissions')
    inlines = [SocialAccountInline]
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'role', 'password1', 'password2'),
            },
        ),
    )

    def get_readonly_fields(self, request, obj=None):
        """Keep identity proofs immutable outside their audited workflows.

        New users still receive an e-mail through ``add_fieldsets``. Once the
        account exists, changing the mailbox/phone or toggling verification in
        Django Admin would detach the value from the evidence that proved it.
        """

        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            fields.extend(['email', 'phone', 'email_verified'])
        return fields

    @admin.display(description='Created at')
    def created_at_display(self, obj):
        return obj.date_joined
