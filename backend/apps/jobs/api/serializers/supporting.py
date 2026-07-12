from django.db import transaction
from django.utils.html import strip_tags
from rest_framework import serializers

from common.media_storage import media_url_from_value
from apps.locations.models import Location

from ...models import (
    Benefit,
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobBenefit,
    JobCategory,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    JobWorkSchedule,
    Language,
    SavedJob,
)


class JobCategorySerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = JobCategory
        fields = ['id', 'name', 'slug', 'description', 'logo_url', 'parent', 'category_type']

    def get_logo_url(self, obj):
        return media_url_from_value(obj.logo_url, request=self.context.get('request'))


class PublicJobCategorySerializer(JobCategorySerializer):
    """Taxonomy fields used by public search and navigation only."""

    class Meta(JobCategorySerializer.Meta):
        fields = ['id', 'name', 'logo_url', 'parent']


class JobSkillSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source='skill.name', read_only=True)

    class Meta:
        model = JobSkill
        fields = ['id', 'skill', 'skill_name', 'importance', 'weight', 'min_level', 'min_years_experience']


class JobCategoryAssignmentSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = JobCategoryAssignment
        fields = ['id', 'category', 'category_name', 'role', 'sort_order']

    def validate(self, attrs):
        category = attrs.get('category')
        role = attrs.get('role')
        expected = {
            JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION: {
                JobCategory.CategoryType.OCCUPATION_GROUP,
                JobCategory.CategoryType.SPECIALIZATION,
                JobCategory.CategoryType.DOMAIN,
            },
            JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE: {JobCategory.CategoryType.DOMAIN},
        }.get(role)
        if category and category.status != JobCategory.Status.ACTIVE:
            raise serializers.ValidationError({'category': 'Danh mục đã ngừng hoạt động.'})
        if category and expected and category.category_type not in expected:
            raise serializers.ValidationError({'category': 'Loại danh mục không phù hợp với vai trò đã chọn.'})
        return attrs


class JobLocationSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.name', read_only=True)
    location_level = serializers.CharField(source='location.level', read_only=True)
    province_id = serializers.SerializerMethodField()
    province_name = serializers.SerializerMethodField()

    class Meta:
        model = JobLocation
        fields = [
            'id', 'location', 'location_name', 'location_level', 'province_id', 'province_name',
            'address_detail', 'sort_order',
        ]

    def validate_location(self, location):
        if location.level != Location.Level.WARD or not location.parent_id:
            raise serializers.ValidationError('Địa điểm làm việc phải là phường/xã có tỉnh/thành cha.')
        if not location.is_active:
            raise serializers.ValidationError('Phường/xã đã ngừng hoạt động.')
        return location

    def validate_address_detail(self, address_detail):
        if not address_detail.strip():
            raise serializers.ValidationError('Cần nhập địa chỉ cụ thể tại phường/xã.')
        return address_detail.strip()

    def get_province_id(self, obj):
        return obj.location.parent_id or obj.location_id

    def get_province_name(self, obj):
        return obj.location.parent.name if obj.location.parent else obj.location.name


class JobWorkScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobWorkSchedule
        fields = [
            'id', 'weekday_from', 'weekday_to', 'start_time', 'end_time',
            'is_overnight', 'note', 'sort_order',
        ]

    def validate(self, attrs):
        structured = [
            attrs.get('weekday_from'), attrs.get('weekday_to'),
            attrs.get('start_time'), attrs.get('end_time'),
        ]
        if any(value is not None for value in structured) and not all(value is not None for value in structured):
            raise serializers.ValidationError('Một khung giờ phải có đủ ngày bắt đầu, ngày kết thúc và giờ bắt đầu/kết thúc.')
        if not any(value is not None for value in structured) and not attrs.get('note', '').strip():
            raise serializers.ValidationError('Cần nhập khung ngày/giờ hoặc ghi chú lịch làm việc.')
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        if start_time and end_time and not attrs.get('is_overnight') and end_time <= start_time:
            raise serializers.ValidationError({'end_time': 'Giờ kết thúc phải sau giờ bắt đầu.'})
        return attrs


class JobBenefitSerializer(serializers.ModelSerializer):
    benefit_name = serializers.CharField(source='benefit.name', read_only=True)

    class Meta:
        model = JobBenefit
        fields = ['id', 'benefit', 'benefit_name', 'note', 'sort_order']

    def validate_benefit(self, benefit):
        if not benefit.is_active:
            raise serializers.ValidationError('Quyền lợi đã ngừng hoạt động.')
        return benefit


class JobLanguageRequirementSerializer(serializers.ModelSerializer):
    language_name = serializers.CharField(source='language.name', read_only=True)
    proficiency_label = serializers.CharField(source='get_proficiency_level_display', read_only=True)

    class Meta:
        model = JobLanguageRequirement
        fields = [
            'id', 'language', 'language_name', 'proficiency_level', 'proficiency_label',
            'certificate', 'note', 'is_required', 'sort_order',
        ]

    def validate_language(self, language):
        if not language.is_active:
            raise serializers.ValidationError('Ngoại ngữ đã ngừng hoạt động.')
        return language


class JobApplicationEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobApplicationEmail
        fields = ['id', 'email', 'sort_order']


class JobApplicationContactSerializer(serializers.ModelSerializer):
    emails = JobApplicationEmailSerializer(many=True)

    class Meta:
        model = JobApplicationContact
        fields = ['recipient_name', 'phone', 'emails']

    def validate_emails(self, emails):
        if not 1 <= len(emails) <= 5:
            raise serializers.ValidationError('Cần từ 1 đến tối đa 5 email nhận hồ sơ.')
        normalized = [item['email'].strip().lower() for item in emails]
        if len(normalized) != len(set(normalized)):
            raise serializers.ValidationError('Email nhận hồ sơ không được trùng nhau.')
        return emails
