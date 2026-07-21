from rest_framework import serializers

from apps.jobs.models import JobCategory
from apps.locations.models import Location

from ...models import CandidateConsent, CandidateJobPreference, CandidateProfile


class CandidateProfileReadSerializer(serializers.ModelSerializer):
    """Minimal profile data rendered by onboarding and job-preference settings."""

    class Meta:
        model = CandidateProfile
        fields = ['gender']
        read_only_fields = fields


class CandidateProfileUpdateSerializer(serializers.ModelSerializer):
    """Write DTO for the only candidate-profile field exposed by current forms."""

    class Meta:
        model = CandidateProfile
        fields = ['gender']


class RecruiterVisibilitySerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    confirmed = serializers.BooleanField(default=False, write_only=True)
    cv_public_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    policy_version = serializers.CharField(max_length=64, default='v1')
    source = serializers.ChoiceField(choices=['cv_save_success', 'account_settings'])
    source_path = serializers.CharField(max_length=2048, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['enabled'] and not attrs['confirmed']:
            raise serializers.ValidationError(
                {'confirmed': 'Bạn cần xác nhận trước khi mở hồ sơ cho nhà tuyển dụng.'}
            )
        return attrs


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
            'desired_position_other',
            'desired_salary_vnd',
            'experience_level',
            'willing_to_relocate',
            'desired_specialization_ids',
            'preferred_province_ids',
            'ai_recommendation_consent',
            'recruiter_visibility_consent',
            'desired_specializations',
            'preferred_provinces',
            'job_preferences_configured',
        ]
        extra_kwargs = {
            'desired_position_other': {
                'required': False,
                'allow_null': True,
                'allow_blank': True,
                'trim_whitespace': True,
            },
            'desired_salary_vnd': {'required': True, 'allow_null': False, 'min_value': 1},
            'willing_to_relocate': {'required': False, 'allow_null': True},
            'experience_level': {'required': True, 'allow_blank': False},
        }

    def validate_desired_position_other(self, value):
        return value.strip() or None

    def validate(self, attrs):
        specializations = attrs['desired_specialization_ids']
        if not 1 <= len(specializations) <= 5:
            raise serializers.ValidationError(
                {
                    'desired_specialization_ids': 'Vui lòng chọn từ 1 đến 5 vị trí chuyên môn.',
                }
            )
        if len({category.pk for category in specializations}) != len(specializations):
            raise serializers.ValidationError(
                {'desired_specialization_ids': 'Danh sách vị trí bị trùng.'}
            )
        invalid_category = next(
            (
                category
                for category in specializations
                if category.status != JobCategory.Status.ACTIVE
                or category.category_type != JobCategory.CategoryType.SPECIALIZATION
            ),
            None,
        )
        if invalid_category:
            raise serializers.ValidationError(
                {
                    'desired_specialization_ids': 'Chỉ được chọn vị trí chuyên môn đang hoạt động.',
                }
            )

        provinces = attrs['preferred_province_ids']
        if not provinces:
            raise serializers.ValidationError(
                {'preferred_province_ids': 'Vui lòng chọn ít nhất một tỉnh/thành.'}
            )
        if len({province.pk for province in provinces}) != len(provinces):
            raise serializers.ValidationError(
                {'preferred_province_ids': 'Danh sách địa điểm bị trùng.'}
            )
        invalid_province = next(
            (
                province
                for province in provinces
                if province.level != Location.Level.PROVINCE or not province.is_active
            ),
            None,
        )
        if invalid_province:
            raise serializers.ValidationError(
                {'preferred_province_ids': 'Chỉ được chọn tỉnh/thành đang hoạt động.'}
            )
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
        data['ai_recommendation_consent'] = decisions.get(
            CandidateConsent.ConsentType.AI_RECOMMENDATION, False
        )
        data['recruiter_visibility_consent'] = decisions.get(
            CandidateConsent.ConsentType.RECRUITER_VISIBILITY, False
        )
        return data
