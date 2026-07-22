from rest_framework import serializers

from ...models import ApplicationStatusHistory


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)

    class Meta:
        model = ApplicationStatusHistory
        fields = ['from_status', 'to_status', 'note', 'changed_by_name', 'created_at']
        read_only_fields = fields
