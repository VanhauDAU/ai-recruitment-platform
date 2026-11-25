from rest_framework import serializers

from ...models import Industry


class AdminIndustrySerializer(serializers.ModelSerializer):
    company_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Industry
        fields = ['id', 'name', 'is_active', 'company_count']
