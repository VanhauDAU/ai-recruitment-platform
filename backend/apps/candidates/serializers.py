from rest_framework import serializers

from apps.jobs.models import JobCategory
from apps.locations.models import Location

from .models import CandidateConsent, CandidateJobPreference, CandidateProfile


class CandidateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateProfile
        fields = [
            'id', 'date_of_birth', 'gender', 'address', 'current_position',
            'desired_position', 'experience_years', 'education_level',
            'expected_salary_min', 'expected_salary_max', 'preferred_location',
            'preferred_work_type', 'job_search_status', 'portfolio_url',
            'github_url', 'linkedin_url', 'headline', 'bio', 'career_objective',
            'job_preferences_configured',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'job_preferences_configured', 'created_at', 'updated_at']


class CandidateJobPreferenceSerializer(serializers.ModelSerializer):
    """Read/write contract shared by onboarding and account preference settings."""

    desired_specialization_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=JobCategory.objects.all(),
    )
    preferred_province_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=Location.objects.all(),
    )
    ai_recommendation_consent = serializers.BooleanField(write_only=True)
    recruiter_visibility_consent = serializers.BooleanField(write_only=True)
    desired_specializations = serializers.SerializerMethodField(read_only=True)
    preferred_provinces = serializers.SerializerMethodField(read_only=True)
    job_preferences_configured = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CandidateJobPreference
        fields = [
            'desired_position_other', 'desired_salary_vnd', 'experience_level', 'willing_to_relocate',
            'desired_specialization_ids', 'preferred_province_ids',
            'ai_recommendation_consent', 'recruiter_visibility_consent',
            'desired_specializations', 'preferred_provinces', 'job_preferences_configured',
        ]
        extra_kwargs = {
            'desired_position_other': {
                'required': False, 'allow_null': True, 'allow_blank': True, 'trim_whitespace': True,
            },
            'desired_salary_vnd': {'required': False, 'allow_null': True, 'min_value': 1},
            'willing_to_relocate': {'required': False, 'allow_null': True},
            'experience_level': {'required': True, 'allow_blank': False},
        }

    def validate_desired_position_other(self, value):
        return value.strip() or None

    def validate(self, attrs):
        specializations = attrs['desired_specialization_ids']
        if not 1 <= len(specializations) <= 5:
            raise serializers.ValidationError({
                'desired_specialization_ids': 'Vui lòng chọn từ 1 đến 5 vị trí chuyên môn.',
            })
        if len({category.pk for category in specializations}) != len(specializations):
            raise serializers.ValidationError({'desired_specialization_ids': 'Danh sách vị trí bị trùng.'})
        invalid_category = next(
            (
                category for category in specializations
                if category.status != JobCategory.Status.ACTIVE
                or category.category_type != JobCategory.CategoryType.SPECIALIZATION
            ),
            None,
        )
        if invalid_category:
            raise serializers.ValidationError({
                'desired_specialization_ids': 'Chỉ được chọn vị trí chuyên môn đang hoạt động.',
            })

        provinces = attrs['preferred_province_ids']
        if not provinces:
            raise serializers.ValidationError({'preferred_province_ids': 'Vui lòng chọn ít nhất một tỉnh/thành.'})
        if len({province.pk for province in provinces}) != len(provinces):
            raise serializers.ValidationError({'preferred_province_ids': 'Danh sách địa điểm bị trùng.'})
        invalid_province = next(
            (
                province for province in provinces
                if province.level != Location.Level.PROVINCE or not province.is_active
            ),
            None,
        )
        if invalid_province:
            raise serializers.ValidationError({'preferred_province_ids': 'Chỉ được chọn tỉnh/thành đang hoạt động.'})
        return attrs

    def get_desired_specializations(self, obj):
        return [
            {
                'id': item.job_category_id,
                'name': item.job_category.name,
                'slug': item.job_category.slug,
            }
            for item in obj.desired_specializations.all()
        ]

    def get_preferred_provinces(self, obj):
        return [
            {'id': item.location_id, 'name': item.location.name, 'code': item.location.code}
            for item in obj.preferred_provinces.all()
        ]

    def get_job_preferences_configured(self, obj):
        return obj.candidate_profile.job_preferences_configured

    def to_representation(self, instance):
        data = super().to_representation(instance)
        decisions = {
            consent.consent_type: consent.decision == CandidateConsent.Decision.GRANTED
            for consent in instance.candidate_profile.consents.all()
        }
        data['ai_recommendation_consent'] = decisions.get(CandidateConsent.ConsentType.AI_RECOMMENDATION, False)
        data['recruiter_visibility_consent'] = decisions.get(CandidateConsent.ConsentType.RECRUITER_VISIBILITY, False)
        return data
