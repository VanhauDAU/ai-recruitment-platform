from rest_framework import serializers

from apps.jobs.models import JobCategory
from apps.locations.models import Location
from apps.skills.models import Skill

from ...models import CandidateConsent, CandidateJobPreference, CandidateProfile


def limited_primary_keys(*, queryset, max_length, message, required=True):
    """DRF many-related field with a runtime and OpenAPI-visible item cap."""
    return serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=queryset),
        write_only=True,
        required=required,
        max_length=max_length,
        error_messages={'max_length': message},
    )


class DesiredPositionOthersField(serializers.ListField):
    """String-list API field backed by ordered normalized child rows."""

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        normalized = []
        seen = set()
        for value in values:
            value = value.strip()
            key = value.casefold()
            if not value or key in seen:
                continue
            normalized.append(value)
            seen.add(key)
        return normalized

    def get_attribute(self, instance):
        return instance

    def to_representation(self, preference):
        return [item.name for item in preference.desired_position_others.all()]


class CandidatePreferredSkillReadSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='skill_id', read_only=True)
    name = serializers.CharField(source='skill.name', read_only=True)
    slug = serializers.CharField(source='skill.slug', read_only=True)


class CandidateDesiredSpecializationReadSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='job_category_id', read_only=True)
    name = serializers.CharField(source='job_category.name', read_only=True)
    slug = serializers.CharField(source='job_category.slug', read_only=True)


class CandidatePreferredProvinceReadSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='location_id', read_only=True)
    name = serializers.CharField(source='location.name', read_only=True)
    code = serializers.CharField(source='location.code', read_only=True)


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

    desired_position_others = DesiredPositionOthersField(
        child=serializers.CharField(
            max_length=255,
            allow_blank=True,
            trim_whitespace=True,
        ),
        required=False,
        max_length=5,
        error_messages={'max_length': 'Chỉ được nhập tối đa 5 vị trí chuyên môn.'},
    )
    desired_specialization_ids = limited_primary_keys(
        queryset=JobCategory.objects.all(),
        max_length=5,
        message='Chỉ được chọn tối đa 5 vị trí chuyên môn.',
    )
    preferred_province_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        write_only=True,
        queryset=Location.objects.all(),
    )
    preferred_skill_ids = limited_primary_keys(
        queryset=Skill.objects.all(),
        max_length=20,
        message='Chỉ được chọn tối đa 20 kỹ năng.',
        required=False,
    )
    ai_recommendation_consent = serializers.BooleanField(write_only=True)
    recruiter_visibility_consent = serializers.BooleanField(write_only=True)
    desired_specializations = CandidateDesiredSpecializationReadSerializer(
        many=True,
        read_only=True,
    )
    preferred_provinces = CandidatePreferredProvinceReadSerializer(many=True, read_only=True)
    preferred_skills = CandidatePreferredSkillReadSerializer(many=True, read_only=True)
    job_preferences_configured = serializers.BooleanField(
        source='candidate_profile.job_preferences_configured',
        read_only=True,
    )

    class Meta:
        model = CandidateJobPreference
        fields = [
            'desired_position_other',
            'desired_position_others',
            'desired_salary_vnd',
            'experience_level',
            'willing_to_relocate',
            'desired_specialization_ids',
            'preferred_province_ids',
            'preferred_skill_ids',
            'ai_recommendation_consent',
            'recruiter_visibility_consent',
            'desired_specializations',
            'preferred_provinces',
            'preferred_skills',
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
        if value is None:
            return None
        return value.strip() or None

    def validate(self, attrs):
        specializations = attrs['desired_specialization_ids']
        if len({category.pk for category in specializations}) != len(specializations):
            raise serializers.ValidationError(
                {'desired_specialization_ids': 'Danh sách vị trí bị trùng.'}
            )
        if len(specializations) > 5:
            raise serializers.ValidationError(
                {'desired_specialization_ids': 'Chỉ được chọn tối đa 5 vị trí chuyên môn.'}
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

        if 'desired_position_others' in attrs:
            custom_positions = attrs['desired_position_others']
        else:
            legacy_position = attrs.get('desired_position_other')
            custom_positions = [legacy_position] if legacy_position else []
        attrs['desired_position_others'] = custom_positions
        attrs['desired_position_other'] = custom_positions[0] if custom_positions else None

        if len(custom_positions) > 5:
            raise serializers.ValidationError(
                {'desired_position_others': 'Chỉ được nhập tối đa 5 vị trí chuyên môn.'}
            )
        if not specializations and not custom_positions:
            raise serializers.ValidationError(
                {'desired_specialization_ids': 'Vui lòng chọn hoặc nhập ít nhất một vị trí.'}
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

        if 'preferred_skill_ids' in attrs:
            skills = []
            seen_skill_ids = set()
            for skill in attrs['preferred_skill_ids']:
                if skill.pk in seen_skill_ids:
                    continue
                skills.append(skill)
                seen_skill_ids.add(skill.pk)
            if len(skills) > 20:
                raise serializers.ValidationError(
                    {'preferred_skill_ids': 'Chỉ được chọn tối đa 20 kỹ năng.'}
                )
            if any(not skill.is_active for skill in skills):
                raise serializers.ValidationError(
                    {'preferred_skill_ids': 'Chỉ được chọn kỹ năng đang hoạt động.'}
                )
            attrs['preferred_skill_ids'] = skills
        return attrs

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
