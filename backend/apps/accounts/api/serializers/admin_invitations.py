"""Administrator invitation contracts."""

from django.utils import timezone
from rest_framework import serializers

from ...models import (
    AdminInvitation,
)
from .auth import password_field


class AdminInvitationSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    invited_by = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = AdminInvitation
        fields = [
            'public_id',
            'user',
            'invited_by',
            'status',
            'reason',
            'expires_at',
            'accepted_at',
            'revoked_at',
            'created_at',
            'updated_at',
        ]

    def get_user(self, obj) -> dict:
        return {
            'public_id': obj.user.public_id,
            'email': obj.user.email,
            'full_name': obj.user.full_name,
            'status': obj.user.status,
        }

    def get_invited_by(self, obj) -> dict:
        return {
            'public_id': obj.invited_by.public_id,
            'email': obj.invited_by.email,
            'full_name': obj.invited_by.full_name,
        }

    def get_status(self, obj) -> str:
        if obj.status == AdminInvitation.Status.PENDING and obj.expires_at <= timezone.now():
            return AdminInvitation.Status.EXPIRED
        return obj.status


class AdminInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)
    reason = serializers.CharField(max_length=500, trim_whitespace=True)

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Họ tên cần ít nhất 2 ký tự.')
        return value


class AdminInvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=True)


class AdminInvitationAcceptSerializer(AdminInvitationTokenSerializer):
    password = password_field()
    password_confirm = serializers.CharField(write_only=True, max_length=25)

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'Mật khẩu xác nhận không khớp.'})
        return attrs
