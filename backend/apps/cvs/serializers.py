from rest_framework import serializers

from common.media_storage import media_url_from_value

from .models import CvSkill, UserCv


class CvSkillSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source='skill.name', read_only=True)

    class Meta:
        model = CvSkill
        fields = ['id', 'skill', 'skill_name', 'source', 'level', 'years_experience', 'evidence_text', 'confidence_score']
        read_only_fields = ['id', 'skill_name', 'source', 'confidence_score']


class UserCvSerializer(serializers.ModelSerializer):
    cv_skills = CvSkillSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = UserCv
        fields = [
            'public_id', 'template', 'cv_type', 'source', 'title', 'cv_data',
            'style_config', 'file_url', 'pdf_url', 'thumbnail_url', 'file_name',
            'file_type', 'current_version', 'status', 'is_default',
            'cv_skills', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'public_id', 'cv_type', 'source', 'file_url', 'pdf_url', 'thumbnail_url',
            'file_name', 'file_type', 'current_version', 'status',
            'cv_skills', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        # This serializer is only used to create/update builder-type CVs
        # (uploaded CVs go through UserCvUploadView instead).
        if self.instance is None and not attrs.get('template'):
            raise serializers.ValidationError('template is required to create a CV.')
        return attrs

    def get_file_url(self, obj):
        return media_url_from_value(obj.file_url, request=self.context.get('request'))

    def get_pdf_url(self, obj):
        return media_url_from_value(obj.pdf_url, request=self.context.get('request'))

    def get_thumbnail_url(self, obj):
        return media_url_from_value(obj.thumbnail_url, request=self.context.get('request'))
