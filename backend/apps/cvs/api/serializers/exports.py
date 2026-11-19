"""PDF export job contracts."""

from django.urls import reverse
from rest_framework import serializers

from apps.cvs.models import CvExport
from apps.cvs.services.exports import export_download_ready


class CvExportCreateSerializer(serializers.Serializer):
    """The version is optional; service defaults to published then latest."""

    version_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)


class CvExportSerializer(serializers.ModelSerializer):
    version_public_id = serializers.CharField(source='version.public_id', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = CvExport
        fields = [
            'public_id',
            'version_public_id',
            'export_format',
            'status',
            'renderer_key',
            'renderer_version',
            'attempts',
            'download_url',
            'queued_at',
            'started_at',
            'completed_at',
            'failed_at',
            'created_at',
        ]
        read_only_fields = fields

    def get_download_url(self, obj) -> str | None:
        if not export_download_ready(obj):
            return None
        url = reverse(
            'cv-export-download',
            kwargs={
                'public_id': obj.cv.public_id,
                'export_public_id': obj.public_id,
            },
        )
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url
