"""Shared job read/write contract every public and employer job serializer extends."""

from django.utils.html import strip_tags
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import (
    Job,
    JobCategoryAssignment,
    JobSkill,
)
from ...selectors.presentation import job_presentation
from ...selectors.verification_badge import (
    BADGE_CACHE_KEY,
    badge_criteria_payload,
    prime_badge_cache,
)
from .supporting import (
    JobBenefitSerializer,
    JobCategoryAssignmentSerializer,
    JobLanguageRequirementSerializer,
    JobLocationSerializer,
    JobSkillSerializer,
    JobWorkScheduleSerializer,
)


class JobVerificationCriterionSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    passed = serializers.BooleanField()


class JobVerificationSerializer(serializers.Serializer):
    verified = serializers.BooleanField()
    criteria = JobVerificationCriterionSerializer(many=True)


class JobListSkillSerializer(serializers.ModelSerializer):
    """The only skill data displayed on public result cards."""

    skill_name = serializers.CharField(source='skill.name', read_only=True)

    class Meta:
        model = JobSkill
        fields = ['skill_name']


class JobBadgeListSerializer(serializers.ListSerializer):
    """Nạp sẵn cờ huy hiệu cho cả trang trước khi render từng tin.

    Không có bước này, mỗi tin sẽ tự truy vấn điều kiện xác thực của cặp
    (công ty, người đăng) và endpoint list vỡ ngân sách truy vấn.
    """

    def to_representation(self, data):
        items = list(data)
        prime_badge_cache(
            self.child.context,
            {(item.company_id, item.posted_by_id) for item in items},
        )
        return super().to_representation(items)


class JobSerializer(serializers.ModelSerializer):
    allow_incomplete_salary = False
    job_skills = JobSkillSerializer(many=True, required=False)
    category_assignments = JobCategoryAssignmentSerializer(many=True, required=False)
    job_locations = JobLocationSerializer(many=True, required=False)
    work_schedules = JobWorkScheduleSerializer(many=True, required=False)
    job_benefits = JobBenefitSerializer(many=True, required=False)
    language_requirements = JobLanguageRequirementSerializer(many=True, required=False)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    company_slug = serializers.SerializerMethodField()
    company_logo_url = serializers.SerializerMethodField()
    # Legacy HTTP name: value belongs to the recruiter who posted this job,
    # not to Company. Keep until clients migrate to an employer-scoped key.
    company_verified = serializers.SerializerMethodField()
    brand_slug = serializers.SerializerMethodField()
    company_cover_url = serializers.SerializerMethodField()
    # Flat summaries derived from the nested rows, for cards that do not need them.
    category = serializers.SerializerMethodField()
    locations_detail = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    presentation = serializers.SerializerMethodField()
    application_reasons = serializers.ListField(
        child=serializers.CharField(max_length=160, allow_blank=False, trim_whitespace=True),
        max_length=3,
        required=False,
    )

    class Meta:
        model = Job
        fields = [
            'public_id',
            'slug',
            'title',
            'company_name',
            'company_slug',
            'company_logo_url',
            'company_cover_url',
            'brand_slug',
            'category',
            'category_assignments',
            'job_locations',
            'locations_detail',
            'short_description',
            'description',
            'requirements',
            'benefits',
            'application_reasons',
            'work_schedule_note',
            'work_type',
            'work_types',
            'employment_type',
            'education_level',
            'experience_years',
            'position_level',
            'gender_requirement',
            'age_min',
            'age_max',
            'number_of_vacancies',
            'salary_type',
            'salary_min',
            'salary_max',
            'income_display_type',
            'currency',
            'deadline',
            'requested_visibility_days',
            'first_approved_at',
            'visibility_starts_at',
            'visibility_ends_at',
            'status',
            'view_count',
            'tier',
            'is_hot',
            'is_urgent',
            'has_flash_badge',
            'presentation',
            'company_verified',
            'application_count',
            'job_skills',
            'work_schedules',
            'job_benefits',
            'language_requirements',
            'published_at',
            'created_at',
            'updated_at',
        ]
        list_serializer_class = JobBadgeListSerializer
        read_only_fields = [
            'public_id',
            'slug',
            'company_name',
            'company_slug',
            'company_logo_url',
            'category',
            'locations_detail',
            'short_description',
            'company_cover_url',
            'brand_slug',
            'company_verified',
            'status',
            'tier',
            'is_hot',
            'is_urgent',
            'has_flash_badge',
            'presentation',
            'requested_visibility_days',
            'view_count',
            'application_count',
            'published_at',
            'first_approved_at',
            'visibility_starts_at',
            'visibility_ends_at',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        work_types = attrs.get('work_types')
        if work_types is not None:
            allowed = {value for value, _ in Job.WorkType.choices}
            if not isinstance(work_types, list) or (
                not work_types and not self.allow_incomplete_salary
            ):
                raise serializers.ValidationError(
                    {'work_types': _('Chọn ít nhất một hình thức làm việc.')}
                )
            if len(work_types) != len(set(work_types)) or any(
                value not in allowed for value in work_types
            ):
                raise serializers.ValidationError(
                    {'work_types': _('Danh sách hình thức làm việc không hợp lệ.')}
                )
            attrs['work_type'] = work_types[0] if work_types else ''
        age_min = attrs.get('age_min', getattr(self.instance, 'age_min', None))
        age_max = attrs.get('age_max', getattr(self.instance, 'age_max', None))
        if age_min is not None and not 15 <= age_min <= 100:
            raise serializers.ValidationError({'age_min': _('Tuổi tối thiểu phải từ 15 đến 100.')})
        if age_max is not None and not 15 <= age_max <= 100:
            raise serializers.ValidationError({'age_max': _('Tuổi tối đa phải từ 15 đến 100.')})
        if age_min is not None and age_max is not None and age_max < age_min:
            raise serializers.ValidationError(
                {'age_max': _('Tuổi tối đa không được nhỏ hơn tuổi tối thiểu.')}
            )

        salary_type = attrs.get(
            'salary_type', getattr(self.instance, 'salary_type', Job.SalaryType.NEGOTIABLE)
        )
        salary_min = attrs.get('salary_min', getattr(self.instance, 'salary_min', None))
        salary_max = attrs.get('salary_max', getattr(self.instance, 'salary_max', None))
        salary_errors = {}
        salary_is_incomplete = (
            (salary_type == Job.SalaryType.RANGE and salary_min is None and salary_max is None)
            or (salary_type in (Job.SalaryType.FIXED, Job.SalaryType.FROM) and salary_min is None)
            or (salary_type == Job.SalaryType.UP_TO and salary_max is None)
        )
        if self.allow_incomplete_salary and salary_is_incomplete:
            attrs['salary_type'] = None
            salary_type = None
        elif salary_type is None:
            salary_errors['salary_type'] = _('Chọn loại lương và nhập đầy đủ mức lương.')
        elif salary_type == Job.SalaryType.NEGOTIABLE and (
            salary_min is not None or salary_max is not None
        ):
            salary_errors['salary_type'] = _('Lương thỏa thuận không được có mức tối thiểu/tối đa.')
        elif salary_type == Job.SalaryType.RANGE:
            if salary_min is None and salary_max is None:
                salary_errors['salary_type'] = _('Nhập ít nhất một mức lương.')
            elif salary_min is not None and salary_max is None:
                attrs['salary_type'] = Job.SalaryType.FROM
                salary_type = Job.SalaryType.FROM
            elif salary_min is None and salary_max is not None:
                attrs['salary_type'] = Job.SalaryType.UP_TO
                salary_type = Job.SalaryType.UP_TO
            elif salary_min is not None and salary_max is not None and salary_max < salary_min:
                salary_errors['salary_max'] = _(
                    'Mức lương tối đa không được nhỏ hơn mức tối thiểu.'
                )
        elif salary_type in (Job.SalaryType.FIXED, Job.SalaryType.FROM) and salary_min is None:
            salary_errors['salary_min'] = _('Loại lương này cần mức lương tối thiểu.')
        elif salary_type == Job.SalaryType.UP_TO and salary_max is None:
            salary_errors['salary_max'] = _('Loại lương này cần mức lương tối đa.')
        if salary_errors:
            raise serializers.ValidationError(salary_errors)

        categories = attrs.get('category_assignments')
        if categories is not None:
            primary_count = sum(
                item['role'] == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
                for item in categories
            )
            if primary_count > 1:
                raise serializers.ValidationError(
                    {'category_assignments': _('Chỉ được chọn một vị trí chuyên môn chính.')}
                )
            keys = [(item['category'].pk, item['role']) for item in categories]
            if len(keys) != len(set(keys)):
                raise serializers.ValidationError(
                    {'category_assignments': _('Danh mục không được chọn trùng.')}
                )

        self._validate_nested_uniqueness(attrs)
        return attrs

    def validate_application_reasons(self, value):
        normalized = [item.strip() for item in value]
        if len({item.casefold() for item in normalized}) != len(normalized):
            raise serializers.ValidationError(_('Các lý do không được trùng nhau.'))
        return normalized

    def _validate_nested_uniqueness(self, attrs):
        unique_fields = {
            'job_skills': lambda item: item['skill'].pk,
            'job_locations': lambda item: (
                item['location'].pk,
                item['address_detail'].strip().lower(),
            ),
            'job_benefits': lambda item: item['benefit'].pk,
            'language_requirements': lambda item: item['language'].pk,
        }
        for relation, key_builder in unique_fields.items():
            items = attrs.get(relation)
            if items is None:
                continue
            keys = [key_builder(item) for item in items]
            if len(keys) != len(set(keys)):
                raise serializers.ValidationError(
                    {relation: _('Danh sách không được chứa mục trùng.')}
                )

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_company_slug(self, obj):
        # A held company page answers 404, so no job surface may link to it.
        company = obj.company
        return None if company.content_policy_hold else company.slug

    def get_company_logo_url(self, obj) -> str | None:
        return media_url_from_value(obj.company.logo_url, request=self.context.get('request'))

    def _badge_payload(self, obj):
        cache = self.__dict__.setdefault('_badge_payload_cache', {})
        key = (obj.company_id, obj.posted_by_id)
        if key not in cache:
            cache[key] = badge_criteria_payload(obj)
        return cache[key]

    @extend_schema_field(serializers.BooleanField)
    def get_company_verified(self, obj):
        cached = self.context.get(BADGE_CACHE_KEY, {})
        key = (obj.company_id, obj.posted_by_id)
        if key in cached:
            return cached[key]
        return self._badge_payload(obj)['verified']

    def get_brand_slug(self, obj) -> str | None:
        company = obj.company
        return company.slug if company.has_brand_page else None

    def get_company_cover_url(self, obj) -> str | None:
        return media_url_from_value(
            obj.company.cover_image_url, request=self.context.get('request')
        )

    @staticmethod
    def _primary_assignment(obj):
        return next(
            (
                item
                for item in obj.category_assignments.all()
                if item.role == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
            ),
            None,
        )

    def get_category(self, obj) -> int | None:
        assignment = self._primary_assignment(obj)
        return assignment.category_id if assignment else None

    def get_locations_detail(self, obj) -> list[dict]:
        provinces = []
        seen = set()
        for item in obj.job_locations.all():
            province = item.location.parent or item.location
            if province.pk in seen:
                continue
            seen.add(province.pk)
            provinces.append({'id': province.pk, 'name': province.name, 'level': 'province'})
        return provinces

    def get_short_description(self, obj) -> str:
        return strip_tags(obj.description).strip()[:240]

    def get_presentation(self, obj) -> dict:
        return job_presentation(obj)
