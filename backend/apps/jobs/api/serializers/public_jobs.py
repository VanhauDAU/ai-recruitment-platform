"""Public job contracts: search cards, the home-page preview and the detail page."""

from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.applications.selectors import flash_badge_stats_for_job
from common.html.plain_text import html_plain_text
from common.storage.media import media_url_from_value

from ...models import Benefit, Job, JobCategoryAssignment, JobSkill
from .jobs import JobListSkillSerializer, JobSerializer, JobVerificationSerializer
from .supporting import (
    PublicJobBenefitSerializer,
    PublicJobLanguageRequirementSerializer,
    PublicJobLocationSerializer,
    PublicJobWorkScheduleSerializer,
)


class PublicJobListSerializer(JobSerializer):
    """Compact contract for public search, related jobs, and saved-job cards."""

    job_skills = JobListSkillSerializer(many=True, read_only=True)

    class Meta(JobSerializer.Meta):
        fields = [
            'public_id',
            'slug',
            'title',
            'company_name',
            'company_slug',
            'company_logo_url',
            'brand_slug',
            'company_verified',
            'category',
            'locations_detail',
            'job_skills',
            'work_type',
            'work_types',
            'employment_type',
            'education_level',
            'experience_years',
            'position_level',
            'age_min',
            'age_max',
            'salary_type',
            'salary_min',
            'salary_max',
            'income_display_type',
            'currency',
            'has_flash_badge',
            'presentation',
            'first_approved_at',
            'published_at',
            'created_at',
        ]
        read_only_fields = fields


class PublicJobPreviewSerializer(PublicJobListSerializer):
    """Extra fields for the intentional hover preview on the home page only."""

    job_locations = PublicJobLocationSerializer(many=True, read_only=True)
    work_schedules = PublicJobWorkScheduleSerializer(many=True, read_only=True)
    job_benefits = PublicJobBenefitSerializer(many=True, read_only=True)

    class Meta(PublicJobListSerializer.Meta):
        fields = PublicJobListSerializer.Meta.fields + [
            'short_description',
            'description',
            'requirements',
            'benefits',
            'application_reasons',
            'work_schedule_note',
            'job_locations',
            'work_schedules',
            'job_benefits',
            'number_of_vacancies',
            'deadline',
            'visibility_ends_at',
        ]


class JobFlashBadgeStatsSerializer(serializers.Serializer):
    """Số liệu thật sau Huy hiệu Sấm Chớp của người đăng tin (ADR-0027)."""

    response_rate = serializers.IntegerField()
    avg_response_hours = serializers.FloatField(allow_null=True)
    matured_count = serializers.IntegerField()
    computed_at = serializers.DateTimeField()


class JobDetailSerializer(JobSerializer):
    """Extended public detail without internal application-recipient data.

    Ngoài dữ liệu thô (nested) dùng cho form employer, serializer này trả thêm
    view-model đã nhóm sẵn cho màn chi tiết ứng viên (tag tóm tắt, địa điểm
    nhóm theo tỉnh/thành, chuyên môn chính/kiến thức chuyên ngành) để frontend
    không phải tự suy luận từ dữ liệu thô.
    """

    category_name = serializers.SerializerMethodField()
    # Legacy HTTP name paired with ``company_verified``; payload is recruiter-scoped.
    company_verification = serializers.SerializerMethodField()
    # Mã công ty để lọc "việc làm cùng công ty" (?company=) mà không phải gọi trang công ty.
    company_public_id = serializers.CharField(source='company.public_id', read_only=True)
    company_size = serializers.CharField(source='company.company_size', read_only=True)
    company_address = serializers.CharField(source='company.public_headquarters', read_only=True)
    company_description = serializers.SerializerMethodField()
    company_website_url = serializers.CharField(source='company.website_url', read_only=True)
    company_industries = serializers.SerializerMethodField()
    primary_specialization = serializers.SerializerMethodField()
    domain_knowledge = serializers.SerializerMethodField()
    workplace_groups = serializers.SerializerMethodField()
    requirement_tags = serializers.SerializerMethodField()
    benefit_tags = serializers.SerializerMethodField()
    required_skills = serializers.SerializerMethodField()
    preferred_skills = serializers.SerializerMethodField()
    benefit_groups = serializers.SerializerMethodField()
    job_locations = PublicJobLocationSerializer(many=True, read_only=True)
    work_schedules = PublicJobWorkScheduleSerializer(many=True, read_only=True)
    language_requirements = PublicJobLanguageRequirementSerializer(many=True, read_only=True)
    # A stopped job stays readable but shows "Hết hạn ứng tuyển" instead of apply.
    accepting_applications = serializers.BooleanField(read_only=True, default=True)
    stopped_at = serializers.DateTimeField(read_only=True)
    flash_badge_stats = serializers.SerializerMethodField()

    class Meta(JobSerializer.Meta):
        model = Job
        fields = [
            'public_id',
            'slug',
            'title',
            'accepting_applications',
            'stopped_at',
            'company_name',
            'company_slug',
            'company_public_id',
            'company_logo_url',
            'company_cover_url',
            'brand_slug',
            'company_verified',
            'company_verification',
            'category',
            'category_name',
            'locations_detail',
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
            'first_approved_at',
            'visibility_ends_at',
            'view_count',
            'presentation',
            'flash_badge_stats',
            'job_locations',
            'work_schedules',
            'language_requirements',
            'published_at',
            'created_at',
            'company_size',
            'company_address',
            'company_description',
            'company_website_url',
            'company_industries',
            'primary_specialization',
            'domain_knowledge',
            'workplace_groups',
            'requirement_tags',
            'benefit_tags',
            'required_skills',
            'preferred_skills',
            'benefit_groups',
        ]
        read_only_fields = fields

    @extend_schema_field(JobVerificationSerializer)
    def get_company_verification(self, obj):
        return self._badge_payload(obj)

    @extend_schema_field(JobFlashBadgeStatsSerializer(allow_null=True))
    def get_flash_badge_stats(self, obj):
        return flash_badge_stats_for_job(obj)

    def get_category_name(self, obj) -> str:
        assignment = self._primary_assignment(obj)
        return assignment.category.name if assignment else ''

    def get_company_description(self, obj) -> str:
        return html_plain_text(obj.company.description)

    def get_company_industries(self, obj) -> list[str]:
        return [industry.name for industry in obj.company.industries.all()]

    @staticmethod
    def _category_summary(category):
        return {'id': category.pk, 'name': category.name, 'slug': category.slug}

    def get_primary_specialization(self, obj) -> dict | None:
        assignment = self._primary_assignment(obj)
        return self._category_summary(assignment.category) if assignment else None

    def get_domain_knowledge(self, obj) -> list[dict]:
        return [
            self._category_summary(item.category)
            for item in obj.category_assignments.all()
            if item.role == JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE
        ]

    def get_workplace_groups(self, obj) -> list[dict]:
        """Địa điểm làm việc nhóm theo tỉnh/thành: mỗi nhóm gồm các dòng địa chỉ phường/xã."""
        groups = {}
        for item in obj.job_locations.all():
            province = item.location.parent or item.location
            group = groups.setdefault(
                province.pk,
                {
                    'province_id': province.pk,
                    'province_name': province.name,
                    'addresses': [],
                },
            )
            ward_name = item.location.name if item.location.parent_id else ''
            display = ', '.join(part for part in [item.address_detail, ward_name] if part)
            group['addresses'].append(
                {
                    'ward_id': item.location_id if item.location.parent_id else None,
                    'ward_name': ward_name,
                    'address_detail': item.address_detail,
                    'display': display or province.name,
                    'latitude': item.latitude,
                    'longitude': item.longitude,
                    'coordinate_precision': item.coordinate_precision,
                }
            )
        return list(groups.values())

    def get_requirement_tags(self, obj) -> list[str]:
        tags = []
        if obj.experience_years == Job.ExperienceYears.NONE:
            tags.append(_('Không yêu cầu kinh nghiệm'))
        elif obj.experience_years:
            tags.append(_('%(years)s kinh nghiệm') % {'years': obj.get_experience_years_display()})
        if obj.age_min and obj.age_max:
            tags.append(_('Tuổi %(min)s - %(max)s') % {'min': obj.age_min, 'max': obj.age_max})
        elif obj.age_min:
            tags.append(_('Từ %(age)s tuổi trở lên') % {'age': obj.age_min})
        elif obj.age_max:
            tags.append(_('Đến %(age)s tuổi') % {'age': obj.age_max})
        if obj.education_level == Job.EducationLevel.NONE:
            tags.append(_('Không yêu cầu bằng cấp'))
        elif obj.education_level:
            tags.append(_('Từ %(level)s trở lên') % {'level': obj.get_education_level_display()})
        if obj.gender_requirement and obj.gender_requirement != Job.GenderRequirement.ANY:
            tags.append(
                _('Giới tính: %(gender)s') % {'gender': obj.get_gender_requirement_display()}
            )
        # Kỹ năng không nằm ở hàng tag tóm tắt nữa: đã có khối riêng dưới "Yêu cầu ứng viên".
        return tags

    def get_benefit_tags(self, obj) -> list[str]:
        return [item.benefit.name for item in obj.job_benefits.all()]

    @staticmethod
    def _skill_names(obj, importance):
        return [item.skill.name for item in obj.job_skills.all() if item.importance == importance]

    def get_required_skills(self, obj) -> list[str]:
        return self._skill_names(obj, JobSkill.Importance.REQUIRED)

    def get_preferred_skills(self, obj) -> list[str]:
        return self._skill_names(obj, JobSkill.Importance.PREFERRED)

    def get_benefit_groups(self, obj) -> list[dict]:
        """Quyền lợi đã chọn, gom theo danh mục và giữ thứ tự khai báo của Benefit.Category."""
        names_by_category = {}
        for item in obj.job_benefits.all():
            names_by_category.setdefault(item.benefit.category, []).append(item.benefit.name)
        return [
            {
                'category': category.value,
                'category_label': category.label,
                'items': names_by_category[category.value],
            }
            for category in Benefit.Category
            if names_by_category.get(category.value)
        ]


def _workplace_display(item):
    ward = item.location
    province = ward.parent
    parts = [item.address_detail, ward.name if province else '', (province or ward).name]
    return ', '.join(part for part in parts if part)


class NearbyWorkplaceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    display = serializers.SerializerMethodField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    precision = serializers.CharField(source='coordinate_precision')
    distance_km = serializers.SerializerMethodField()

    def get_display(self, obj) -> str:
        return _workplace_display(obj)

    def get_distance_km(self, obj) -> float:
        return round(obj.distance_km, 2)


class PublicNearbyJobSerializer(PublicJobListSerializer):
    """Search card plus how close the job is to the candidate's chosen point."""

    distance_km = serializers.SerializerMethodField()
    match_kind = serializers.CharField(read_only=True)
    nearest_workplace = serializers.SerializerMethodField()
    nearby_workplace_count = serializers.SerializerMethodField()

    class Meta(PublicJobListSerializer.Meta):
        fields = [
            *PublicJobListSerializer.Meta.fields,
            'deadline',
            'distance_km',
            'match_kind',
            'nearest_workplace',
            'nearby_workplace_count',
        ]
        read_only_fields = fields

    def get_distance_km(self, obj) -> float | None:
        return None if obj.distance_km is None else round(obj.distance_km, 2)

    @extend_schema_field(NearbyWorkplaceSerializer(allow_null=True))
    def get_nearest_workplace(self, obj):
        workplaces = getattr(obj, 'nearby_workplaces', [])
        return NearbyWorkplaceSerializer(workplaces[0]).data if workplaces else None

    def get_nearby_workplace_count(self, obj) -> int:
        return len(getattr(obj, 'nearby_workplaces', []))


class NearbyMarkerJobSerializer(serializers.Serializer):
    slug = serializers.CharField(source='job.slug')
    title = serializers.CharField(source='job.title')
    company_name = serializers.CharField(source='job.company.company_name')
    company_logo_url = serializers.SerializerMethodField()
    salary_type = serializers.CharField(source='job.salary_type')
    salary_min = serializers.DecimalField(
        source='job.salary_min', max_digits=14, decimal_places=2, allow_null=True
    )
    salary_max = serializers.DecimalField(
        source='job.salary_max', max_digits=14, decimal_places=2, allow_null=True
    )
    currency = serializers.CharField(source='job.currency')
    workplace = serializers.SerializerMethodField()

    def get_company_logo_url(self, obj) -> str | None:
        return media_url_from_value(obj.job.company.logo_url, request=self.context.get('request'))

    def get_workplace(self, obj) -> str:
        return _workplace_display(obj)


class NearbyMarkerSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    precision = serializers.CharField()
    distance_km = serializers.SerializerMethodField()
    label = serializers.CharField(help_text='Tên phường/xã của điểm')
    jobs = NearbyMarkerJobSerializer(source='workplaces', many=True)

    def get_distance_km(self, obj) -> float:
        return round(obj['distance_km'], 2)
