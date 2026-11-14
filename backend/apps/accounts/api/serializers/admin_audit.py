from rest_framework import serializers

from ...models import AdminAccessAuditLog


class AdminAuditLogSerializer(serializers.ModelSerializer):
    """Một dòng nhật ký. ``actor_email`` rỗng khi thao tác đến từ CLI/seed."""

    actor_email = serializers.CharField(source='actor.email', default='', read_only=True)

    class Meta:
        model = AdminAccessAuditLog
        fields = [
            'public_id',
            'action',
            'source',
            'actor_email',
            'actor_identifier',
            'target_type',
            'target_public_id',
            'payload',
            'created_at',
        ]
