from django.db import transaction
from django.utils.html import strip_tags
from rest_framework import serializers

from common.media_storage import media_url_from_value
from common.rich_text import rich_text_plain_text

from ...models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobBenefit,
    JobCategoryAssignment,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    JobWorkSchedule,
)
from .supporting import (
    JobApplicationContactSerializer,
    JobBenefitSerializer,
    JobCategoryAssignmentSerializer,
    JobLanguageRequirementSerializer,
    JobLocationSerializer,
    JobSkillSerializer,
    JobWorkScheduleSerializer,
    PublicJobBenefitSerializer,
    PublicJobLanguageRequirementSerializer,
    PublicJobLocationSerializer,
    PublicJobWorkScheduleSerializer,
)


class JobListSkillSerializer(serializers.ModelSerializer):
    """The only skill data displayed on public result cards."""

    skill_name = serializers.CharField(source='skill.name', read_only=True)

    class Meta:
        model = JobSkill
        fields = ['skill_name']


class JobSerializer(serializers.ModelSerializer):
    job_skills = JobSkillSerializer(many=True, required=False)
    category_assignments = JobCategoryAssignmentSerializer(many=True, required=False)
    job_locations = JobLocationSerializer(many=True, required=False)
    work_schedules = JobWorkScheduleSerializer(many=True, required=False)
    job_benefits = JobBenefitSerializer(many=True, required=False)
    language_requirements = JobLanguageRequirementSerializer(many=True, required=False)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    company_logo_url = serializers.SerializerMethodField()
    company_verified = serializers.SerializerMethodField()
    brand_slug = serializers.SerializerMethodField()
    company_cover_url = serializers.SerializerMethodField()
    # Read-only compatibility fields for the current candidate frontend. They are
    # derived from normalized data and no longer create duplicate database columns.
    category = serializers.SerializerMethodField()
    locations_detail = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    is_salary_visible = serializers.SerializerMethodField()

    NESTED_RELATIONS = {
        'job_skills': (JobSkill, 'job_skills'),
        'category_assignments': (JobCategoryAssignment, 'category_assignments'),
        'job_locations': (JobLocation, 'job_locations'),
        'work_schedules': (JobWorkSchedule, 'work_schedules'),
        'job_benefits': (JobBenefit, 'job_benefits'),
        'language_requirements': (JobLanguageRequirement, 'language_requirements'),
    }

    class Meta:
        model = Job
        fields = [
            'public_id', 'slug', 'title', 'company_name', 'company_logo_url',
            'company_cover_url', 'brand_slug', 'category', 'category_assignments',
            'job_locations', 'locations_detail', 'short_description', 'description',
            'requirements', 'benefits', 'work_schedule_note',
            'work_type', 'employment_type', 'education_level', 'experience_years',
            'position_level', 'gender_requirement', 'age_min', 'age_max',
            'number_of_vacancies', 'salary_type', 'salary_min', 'salary_max', 'currency',
            'is_salary_visible', 'deadline', 'status', 'view_count',
            'tier', 'is_hot', 'is_urgent', 'has_flash_badge', 'company_verified',
            'application_count', 'job_skills', 'work_schedules', 'job_benefits',
            'language_requirements', 'published_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'public_id', 'slug', 'company_name', 'company_logo_url', 'category',
            'locations_detail', 'short_description', 'is_salary_visible',
            'company_cover_url', 'brand_slug', 'company_verified', 'status',
            'tier', 'is_hot', 'is_urgent', 'has_flash_badge',
            'view_count', 'application_count', 'published_at', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        age_min = attrs.get('age_min', getattr(self.instance, 'age_min', None))
        age_max = attrs.get('age_max', getattr(self.instance, 'age_max', None))
        if age_min is not None and not 15 <= age_min <= 100:
            raise serializers.ValidationError({'age_min': 'Tuổi tối thiểu phải từ 15 đến 100.'})
        if age_max is not None and not 15 <= age_max <= 100:
            raise serializers.ValidationError({'age_max': 'Tuổi tối đa phải từ 15 đến 100.'})
        if age_min is not None and age_max is not None and age_max < age_min:
            raise serializers.ValidationError({'age_max': 'Tuổi tối đa không được nhỏ hơn tuổi tối thiểu.'})

        salary_type = attrs.get('salary_type', getattr(self.instance, 'salary_type', Job.SalaryType.NEGOTIABLE))
        salary_min = attrs.get('salary_min', getattr(self.instance, 'salary_min', None))
        salary_max = attrs.get('salary_max', getattr(self.instance, 'salary_max', None))
        salary_errors = {}
        if salary_type == Job.SalaryType.NEGOTIABLE and (salary_min is not None or salary_max is not None):
            salary_errors['salary_type'] = 'Lương thỏa thuận không được có mức tối thiểu/tối đa.'
        elif salary_type == Job.SalaryType.RANGE:
            if salary_min is None or salary_max is None:
                salary_errors['salary_type'] = 'Khoảng lương cần đủ mức tối thiểu và tối đa.'
            elif salary_max < salary_min:
                salary_errors['salary_max'] = 'Mức lương tối đa không được nhỏ hơn mức tối thiểu.'
        elif salary_type in (Job.SalaryType.FIXED, Job.SalaryType.FROM) and salary_min is None:
            salary_errors['salary_min'] = 'Loại lương này cần mức lương tối thiểu.'
        elif salary_type == Job.SalaryType.UP_TO and salary_max is None:
            salary_errors['salary_max'] = 'Loại lương này cần mức lương tối đa.'
        if salary_errors:
            raise serializers.ValidationError(salary_errors)

        categories = attrs.get('category_assignments')
        if categories is not None:
            primary_count = sum(
                item['role'] == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
                for item in categories
            )
            if primary_count > 1:
                raise serializers.ValidationError({'category_assignments': 'Chỉ được chọn một vị trí chuyên môn chính.'})
            keys = [(item['category'].pk, item['role']) for item in categories]
            if len(keys) != len(set(keys)):
                raise serializers.ValidationError({'category_assignments': 'Danh mục không được chọn trùng.'})

        self._validate_nested_uniqueness(attrs)
        return attrs

    def _validate_nested_uniqueness(self, attrs):
        unique_fields = {
            'job_skills': lambda item: item['skill'].pk,
            'job_locations': lambda item: (item['location'].pk, item['address_detail'].strip().lower()),
            'job_benefits': lambda item: item['benefit'].pk,
            'language_requirements': lambda item: item['language'].pk,
        }
        for relation, key_builder in unique_fields.items():
            items = attrs.get(relation)
            if items is None:
                continue
            keys = [key_builder(item) for item in items]
            if len(keys) != len(set(keys)):
                raise serializers.ValidationError({relation: 'Danh sách không được chứa mục trùng.'})

    @transaction.atomic
    def create(self, validated_data):
        nested = self._pop_nested(validated_data)
        job = Job.objects.create(**validated_data)
        self._replace_nested(job, nested)
        return job

    @transaction.atomic
    def update(self, instance, validated_data):
        nested = self._pop_nested(validated_data, missing=None)
        job = super().update(instance, validated_data)
        self._replace_nested(job, nested)
        return job

    def _pop_nested(self, validated_data, missing=()):
        return {
            field: validated_data.pop(field, missing)
            for field in self.NESTED_RELATIONS
        }

    def _replace_nested(self, job, nested):
        for field, values in nested.items():
            if values is None:
                continue
            model, related_name = self.NESTED_RELATIONS[field]
            getattr(job, related_name).all().delete()
            model.objects.bulk_create([model(job=job, **item) for item in values])

    def get_company_logo_url(self, obj):
        return media_url_from_value(obj.company.logo_url, request=self.context.get('request'))

    def get_company_verified(self, obj):
        return bool(obj.company.verified_at)

    def get_brand_slug(self, obj):
        company = obj.company
        return company.slug if company.has_brand_page else None

    def get_company_cover_url(self, obj):
        return media_url_from_value(obj.company.cover_image_url, request=self.context.get('request'))

    @staticmethod
    def _primary_assignment(obj):
        return next(
            (
                item for item in obj.category_assignments.all()
                if item.role == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
            ),
            None,
        )

    def get_category(self, obj):
        assignment = self._primary_assignment(obj)
        return assignment.category_id if assignment else None

    def get_locations_detail(self, obj):
        provinces = []
        seen = set()
        for item in obj.job_locations.all():
            province = item.location.parent or item.location
            if province.pk in seen:
                continue
            seen.add(province.pk)
            provinces.append({'id': province.pk, 'name': province.name, 'level': 'province'})
        return provinces

    def get_short_description(self, obj):
        return strip_tags(obj.description).strip()[:240]

    def get_is_salary_visible(self, obj):
        return obj.salary_type != Job.SalaryType.NEGOTIABLE


class PublicJobListSerializer(JobSerializer):
    """Compact contract for public search, related jobs, and saved-job cards."""

    job_skills = JobListSkillSerializer(many=True, read_only=True)

    class Meta(JobSerializer.Meta):
        fields = [
            'public_id', 'slug', 'title',
            'company_name', 'company_logo_url', 'brand_slug', 'company_verified',
            'category', 'locations_detail', 'job_skills',
            'work_type', 'employment_type', 'education_level', 'experience_years',
            'position_level', 'age_min', 'age_max',
            'salary_type', 'salary_min', 'salary_max', 'currency',
            'tier', 'is_hot', 'is_urgent', 'has_flash_badge',
            'published_at', 'created_at',
        ]
        read_only_fields = fields


class PublicJobPreviewSerializer(PublicJobListSerializer):
    """Extra fields for the intentional hover preview on the home page only."""

    job_locations = PublicJobLocationSerializer(many=True, read_only=True)
    work_schedules = PublicJobWorkScheduleSerializer(many=True, read_only=True)
    job_benefits = PublicJobBenefitSerializer(many=True, read_only=True)

    class Meta(PublicJobListSerializer.Meta):
        fields = PublicJobListSerializer.Meta.fields + [
            'short_description', 'description', 'requirements', 'benefits',
            'work_schedule_note', 'job_locations', 'work_schedules', 'job_benefits',
            'number_of_vacancies', 'deadline',
        ]


class JobDetailSerializer(JobSerializer):
    """Extended public detail without internal application-recipient data.

    Ngoài dữ liệu thô (nested) dùng cho form employer, serializer này trả thêm
    view-model đã nhóm sẵn cho màn chi tiết ứng viên (tag tóm tắt, địa điểm
    nhóm theo tỉnh/thành, chuyên môn chính/kiến thức chuyên ngành) để frontend
    không phải tự suy luận từ dữ liệu thô.
    """

    category_name = serializers.SerializerMethodField()
    company_size = serializers.CharField(source='company.company_size', read_only=True)
    company_address = serializers.CharField(source='company.address', read_only=True)
    company_description = serializers.SerializerMethodField()
    company_website_url = serializers.CharField(source='company.website_url', read_only=True)
    company_industries = serializers.SerializerMethodField()
    primary_specialization = serializers.SerializerMethodField()
    domain_knowledge = serializers.SerializerMethodField()
    workplace_groups = serializers.SerializerMethodField()
    requirement_tags = serializers.SerializerMethodField()
    benefit_tags = serializers.SerializerMethodField()
    job_locations = PublicJobLocationSerializer(many=True, read_only=True)
    work_schedules = PublicJobWorkScheduleSerializer(many=True, read_only=True)
    language_requirements = PublicJobLanguageRequirementSerializer(many=True, read_only=True)

    class Meta:
        model = Job
        fields = [
            'public_id', 'slug', 'title',
            'company_name', 'company_logo_url', 'company_cover_url',
            'brand_slug', 'company_verified',
            'category', 'category_name', 'locations_detail',
            'description', 'requirements', 'benefits', 'work_schedule_note',
            'work_type', 'employment_type', 'education_level', 'experience_years',
            'position_level', 'number_of_vacancies',
            'salary_type', 'salary_min', 'salary_max', 'currency', 'deadline',
            'view_count', 'is_hot', 'is_urgent',
            'job_locations', 'work_schedules', 'language_requirements',
            'published_at', 'created_at',
            'company_size', 'company_address', 'company_description',
            'company_website_url', 'company_industries', 'primary_specialization',
            'domain_knowledge', 'workplace_groups', 'requirement_tags', 'benefit_tags',
        ]
        read_only_fields = fields

    def get_category_name(self, obj):
        assignment = self._primary_assignment(obj)
        return assignment.category.name if assignment else ''

    def get_company_description(self, obj):
        return rich_text_plain_text(obj.company.description)

    def get_company_industries(self, obj):
        return [industry.name for industry in obj.company.industries.all()]

    @staticmethod
    def _category_summary(category):
        return {'id': category.pk, 'name': category.name, 'slug': category.slug}

    def get_primary_specialization(self, obj):
        assignment = self._primary_assignment(obj)
        return self._category_summary(assignment.category) if assignment else None

    def get_domain_knowledge(self, obj):
        return [
            self._category_summary(item.category)
            for item in obj.category_assignments.all()
            if item.role == JobCategoryAssignment.Role.DOMAIN_KNOWLEDGE
        ]

    def get_workplace_groups(self, obj):
        """Địa điểm làm việc nhóm theo tỉnh/thành: mỗi nhóm gồm các dòng địa chỉ phường/xã."""
        groups = {}
        for item in obj.job_locations.all():
            province = item.location.parent or item.location
            group = groups.setdefault(province.pk, {
                'province_id': province.pk,
                'province_name': province.name,
                'addresses': [],
            })
            ward_name = item.location.name if item.location.parent_id else ''
            display = ', '.join(part for part in [item.address_detail, ward_name] if part)
            group['addresses'].append({
                'ward_id': item.location_id if item.location.parent_id else None,
                'ward_name': ward_name,
                'address_detail': item.address_detail,
                'display': display or province.name,
            })
        return list(groups.values())

    def get_requirement_tags(self, obj):
        tags = []
        if obj.experience_years == Job.ExperienceYears.NONE:
            tags.append('Không yêu cầu kinh nghiệm')
        elif obj.experience_years:
            tags.append(f'{obj.get_experience_years_display()} kinh nghiệm')
        if obj.age_min and obj.age_max:
            tags.append(f'Tuổi {obj.age_min} - {obj.age_max}')
        elif obj.age_min:
            tags.append(f'Từ {obj.age_min} tuổi trở lên')
        elif obj.age_max:
            tags.append(f'Đến {obj.age_max} tuổi')
        if obj.education_level == Job.EducationLevel.NONE:
            tags.append('Không yêu cầu bằng cấp')
        elif obj.education_level:
            tags.append(f'Từ {obj.get_education_level_display()} trở lên')
        if obj.gender_requirement and obj.gender_requirement != Job.GenderRequirement.ANY:
            tags.append(f'Giới tính: {obj.get_gender_requirement_display()}')
        tags.extend(
            item.skill.name
            for item in obj.job_skills.all()
            if item.importance == JobSkill.Importance.REQUIRED
        )
        return tags

    def get_benefit_tags(self, obj):
        return [item.benefit.name for item in obj.job_benefits.all()]


class EmployerJobWriteSerializer(JobSerializer):
    """Create/update DTO for the employer job form; never used for public reads."""

    application_contact = JobApplicationContactSerializer(required=False, allow_null=True)

    class Meta(JobSerializer.Meta):
        fields = JobSerializer.Meta.fields + ['application_contact']

    @transaction.atomic
    def create(self, validated_data):
        contact = validated_data.pop('application_contact', None)
        job = super().create(validated_data)
        self._replace_contact(job, contact)
        return job

    @transaction.atomic
    def update(self, instance, validated_data):
        marker = object()
        contact = validated_data.pop('application_contact', marker)
        job = super().update(instance, validated_data)
        if contact is not marker:
            self._replace_contact(job, contact)
        return job

    def _replace_contact(self, job, contact_data):
        JobApplicationContact.objects.filter(job=job).delete()
        if not contact_data:
            return
        emails = contact_data.pop('emails')
        contact = JobApplicationContact.objects.create(job=job, **contact_data)
        JobApplicationEmail.objects.bulk_create([
            JobApplicationEmail(contact=contact, **item) for item in emails
        ])


class EmployerJobDetailSerializer(EmployerJobWriteSerializer):
    """Employer form read DTO, including private application recipients."""


class EmployerJobListSerializer(PublicJobListSerializer):
    """Compact management-table DTO; rich job content stays on the detail API."""

    class Meta(PublicJobListSerializer.Meta):
        fields = [
            'public_id', 'title', 'company_name', 'locations_detail',
            'employment_type', 'deadline', 'status', 'application_count',
            'published_at', 'created_at', 'updated_at',
        ]
        read_only_fields = fields
