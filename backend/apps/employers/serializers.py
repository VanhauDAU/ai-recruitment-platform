from rest_framework import serializers

from .models import EmployerProfile, Industry


class IndustrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Industry
        fields = ['id', 'name', 'slug']


class EmployerProfileSerializer(serializers.ModelSerializer):
    # write: list of industry ids; read: expanded objects (cùng khuôn locations/locations_detail ở jobs).
    industries = serializers.PrimaryKeyRelatedField(many=True, write_only=True, queryset=Industry.objects.all(), required=False)
    industries_detail = IndustrySerializer(source='industries', many=True, read_only=True)

    class Meta:
        model = EmployerProfile
        fields = [
            'id', 'public_id', 'company_name', 'slug', 'company_logo_url',
            'cover_image_url', 'company_size', 'industries', 'industries_detail', 'founded_year',
            'website_url', 'tax_code', 'address', 'description', 'status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'public_id', 'slug', 'status', 'created_at', 'updated_at']

    def create(self, validated_data):
        industries = validated_data.pop('industries', [])
        profile = EmployerProfile.objects.create(**validated_data)
        profile.industries.set(industries)
        return profile

    def update(self, instance, validated_data):
        industries = validated_data.pop('industries', None)
        profile = super().update(instance, validated_data)
        if industries is not None:
            profile.industries.set(industries)
        return profile
