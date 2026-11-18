"""CV media contracts: avatar upload request and asset descriptor."""

from django.urls import reverse
from rest_framework import serializers

from apps.cvs.models import CvAsset
from apps.cvs.services.assets import sign_asset


class CvAssetUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=False)
    upload_session = serializers.CharField(max_length=50, required=False, trim_whitespace=True)

    def validate(self, attrs):
        if bool(attrs.get('file')) == bool(attrs.get('upload_session')):
            raise serializers.ValidationError(
                {'upload_session': 'Gửi đúng một trong file hoặc upload_session.'}
            )
        return attrs


class CvAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = CvAsset
        fields = [
            'public_id',
            'kind',
            'title',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'url',
        ]
        read_only_fields = fields

    def get_url(self, obj) -> str:
        path = reverse('cv-asset-content', kwargs={'asset_public_id': obj.public_id})
        # Backgrounds are public catalogue media; an avatar URL carries its own read token.
        if obj.kind == CvAsset.Kind.AVATAR:
            path = f'{path}?token={sign_asset(obj)}'
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path
