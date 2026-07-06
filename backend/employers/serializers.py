from rest_framework import serializers

from .models import EmployerProfile


class EmployerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployerProfile
        fields = [
            'id', 'public_id', 'company_name', 'slug', 'company_logo_url',
            'cover_image_url', 'company_size', 'industry', 'founded_year',
            'website_url', 'tax_code', 'address', 'description', 'status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'slug', 'status', 'created_at', 'updated_at']
