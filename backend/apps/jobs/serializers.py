from django.db import transaction
from django.utils.html import strip_tags
from rest_framework import serializers

from common.media_storage import media_url_from_value
from apps.locations.models import Location

from .models import (
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


class JobSerializer(serializers.ModelSerializer):
    job_skills = JobSkillSerializer(many=True, required=False)
    category_assignments = JobCategoryAssignmentSerializer(many=True, required=False)
    job_locations = JobLocationSerializer(many=True, required=False)
    work_schedules = JobWorkScheduleSerializer(many=True, required=False)
    job_benefits = JobBenefitSerializer(many=True, required=False)
    language_requirements = JobLanguageRequirementSerializer(many=True, required=False)
    company_name = serializers.CharField(source='employer_profile.company_name', read_only=True)
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
        return media_url_from_value(obj.employer_profile.company_logo_url, request=self.context.get('request'))

    def get_company_verified(self, obj):
        return bool(obj.employer_profile.verified_at)

    def get_brand_slug(self, obj):
        profile = obj.employer_profile
        return profile.slug if profile.has_brand_page else None

    def get_company_cover_url(self, obj):
        return media_url_from_value(obj.employer_profile.cover_image_url, request=self.context.get('request'))

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


class JobDetailSerializer(JobSerializer):
    """Extended public detail without internal application-recipient data.

    Ngoài dữ liệu thô (nested) dùng cho form employer, serializer này trả thêm
    view-model đã nhóm sẵn cho màn chi tiết ứng viên (tag tóm tắt, địa điểm
    nhóm theo tỉnh/thành, chuyên môn chính/kiến thức chuyên ngành) để frontend
    không phải tự suy luận từ dữ liệu thô.
    """

    category_name = serializers.SerializerMethodField()
    company_size = serializers.CharField(source='employer_profile.company_size', read_only=True)
    company_address = serializers.CharField(source='employer_profile.address', read_only=True)
    company_description = serializers.CharField(source='employer_profile.description', read_only=True)
    company_website_url = serializers.CharField(source='employer_profile.website_url', read_only=True)
    company_industries = serializers.SerializerMethodField()
    primary_specialization = serializers.SerializerMethodField()
    domain_knowledge = serializers.SerializerMethodField()
    workplace_groups = serializers.SerializerMethodField()
    requirement_tags = serializers.SerializerMethodField()
    benefit_tags = serializers.SerializerMethodField()

    class Meta(JobSerializer.Meta):
        fields = JobSerializer.Meta.fields + [
            'category_name', 'company_size', 'company_address', 'company_description',
            'company_website_url', 'company_industries', 'primary_specialization',
            'domain_knowledge', 'workplace_groups', 'requirement_tags', 'benefit_tags',
        ]

    def get_category_name(self, obj):
        assignment = self._primary_assignment(obj)
        return assignment.category.name if assignment else ''

    def get_company_industries(self, obj):
        return [industry.name for industry in obj.employer_profile.industries.all()]

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


class EmployerJobSerializer(JobDetailSerializer):
    application_contact = JobApplicationContactSerializer(required=False, allow_null=True)

    class Meta(JobDetailSerializer.Meta):
        fields = JobDetailSerializer.Meta.fields + ['application_contact']

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


class BenefitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Benefit
        fields = ['id', 'name', 'slug', 'icon', 'description']


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'name', 'code', 'slug']


class SavedJobSerializer(serializers.ModelSerializer):
    job = serializers.SlugRelatedField(slug_field='public_id', queryset=Job.objects.all(), write_only=True)
    job_detail = JobSerializer(source='job', read_only=True)

    class Meta:
        model = SavedJob
        fields = ['job', 'job_detail', 'created_at']
        read_only_fields = ['created_at']
        validators = []

    def create(self, validated_data):
        saved_job, _ = SavedJob.objects.get_or_create(**validated_data)
        return saved_job
