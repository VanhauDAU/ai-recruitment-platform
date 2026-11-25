from rest_framework import serializers

from apps.jobs.models import Job


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
