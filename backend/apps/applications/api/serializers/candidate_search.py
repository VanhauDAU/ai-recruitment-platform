from rest_framework import serializers

from apps.applications.models import CandidateSearchInvitation
from apps.jobs.models import Job
from common.storage.media import media_url_from_value


class CandidateSearchQuerySerializer(serializers.Serializer):
    """Tham số của Tìm CV: tin làm mốc và các bộ lọc theo hồ sơ trích xuất."""

    job = serializers.CharField(max_length=50)
    q = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    min_months = serializers.IntegerField(min_value=0, max_value=600, required=False, default=None)
    education = serializers.ChoiceField(
        choices=Job.EducationLevel.values, required=False, allow_blank=True, default=''
    )
    language = serializers.CharField(max_length=5, required=False, allow_blank=True, default='')
    province = serializers.IntegerField(min_value=1, required=False, default=None)
    skills = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, max_length=10, default=list
    )
    page = serializers.IntegerField(min_value=1, required=False, default=1)


class CandidateSearchInviteSerializer(serializers.Serializer):
    job = serializers.CharField(max_length=50)


class CandidateSearchInvitationSerializer(serializers.ModelSerializer):
    """Lời mời kết nối ứng viên nhận được: công ty, tin và trạng thái phản hồi."""

    company_name = serializers.CharField(source='job.company.company_name', read_only=True)
    company_slug = serializers.CharField(source='job.company.slug', read_only=True)
    company_logo_url = serializers.SerializerMethodField()
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    job_slug = serializers.CharField(source='job.slug', read_only=True)
    # Khi NTD đã dừng tuyển tin này; null khi tin còn mở.
    job_stopped_at = serializers.DateTimeField(source='job.stopped_at', read_only=True)

    class Meta:
        model = CandidateSearchInvitation
        fields = [
            'public_id',
            'status',
            'invited_at',
            'responded_at',
            'company_name',
            'company_slug',
            'company_logo_url',
            'job_public_id',
            'job_title',
            'job_slug',
            'job_stopped_at',
        ]
        read_only_fields = fields

    def get_company_logo_url(self, obj) -> str | None:
        return media_url_from_value(obj.job.company.logo_url, request=self.context.get('request'))


class CandidateSearchInvitationResponseSerializer(serializers.Serializer):
    accept = serializers.BooleanField()
