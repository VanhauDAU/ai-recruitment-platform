from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class JobCategory(models.Model):
    """Industry/field taxonomy for filtering jobs (DB doc section 2.10)."""

    class CategoryType(models.TextChoices):
        OCCUPATION_GROUP = 'occupation_group', 'Nhóm nghề'
        DOMAIN = 'domain', 'Kiến thức chuyên ngành'
        SPECIALIZATION = 'specialization', 'Vị trí chuyên môn'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    logo_url = models.TextField(
        blank=True,
        help_text='Storage key nội bộ hoặc URL ngoài; API tự resolve storage key thành URL public.',
    )
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    category_type = models.CharField(
        max_length=30,
        choices=CategoryType.choices,
        default=CategoryType.SPECIALIZATION,
    )
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'job categories'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Job(models.Model):
    """A job posting / Job Description (DB doc section 2.12)."""

    class WorkType(models.TextChoices):
        ONSITE = 'onsite', 'Onsite'
        REMOTE = 'remote', 'Remote'
        HYBRID = 'hybrid', 'Hybrid'

    class EmploymentType(models.TextChoices):
        FULL_TIME = 'full_time', 'Full-time'
        PART_TIME = 'part_time', 'Part-time'
        CONTRACT = 'contract', 'Hợp đồng'
        SEASONAL = 'seasonal', 'Thời vụ'
        INTERNSHIP = 'internship', 'Internship'
        FREELANCE = 'freelance', 'Freelance'

    class ExperienceYears(models.TextChoices):
        NONE = 'none', 'Không yêu cầu'
        UNDER_1 = 'under_1', 'Dưới 1 năm'
        ONE = '1', '1 năm'
        TWO = '2', '2 năm'
        THREE = '3', '3 năm'
        FOUR = '4', '4 năm'
        FIVE = '5', '5 năm'
        OVER_5 = 'over_5', 'Trên 5 năm'

    class PositionLevel(models.TextChoices):
        EMPLOYEE = 'employee', 'Nhân viên'
        TEAM_LEAD = 'team_lead', 'Trưởng nhóm'
        MANAGER = 'manager', 'Trưởng/Phó phòng'
        SUPERVISOR = 'supervisor', 'Quản lý / Giám sát'
        BRANCH_MANAGER = 'branch_manager', 'Trưởng chi nhánh'
        VICE_DIRECTOR = 'vice_director', 'Phó giám đốc'
        DIRECTOR = 'director', 'Giám đốc'
        INTERN = 'intern', 'Thực tập sinh'

    class EducationLevel(models.TextChoices):
        NONE = 'none', 'Không yêu cầu'
        MIDDLE_SCHOOL = 'middle_school', 'Trung học cơ sở (Cấp 2)'
        HIGH_SCHOOL = 'high_school', 'Trung học phổ thông (Cấp 3)'
        INTERMEDIATE = 'intermediate', 'Trung cấp'
        COLLEGE = 'college', 'Cao đẳng'
        UNIVERSITY = 'university', 'Đại học'
        POSTGRADUATE = 'postgraduate', 'Cao học'

    class GenderRequirement(models.TextChoices):
        ANY = 'any', 'Không yêu cầu'
        MALE = 'male', 'Nam'
        FEMALE = 'female', 'Nữ'

    class SalaryType(models.TextChoices):
        NEGOTIABLE = 'negotiable', 'Thỏa thuận'
        RANGE = 'range', 'Khoảng lương'
        FIXED = 'fixed', 'Mức cố định'
        FROM = 'from', 'Từ mức'
        UP_TO = 'up_to', 'Đến mức'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        CLOSED = 'closed', 'Closed'
        REJECTED = 'rejected', 'Rejected'

    class Tier(models.TextChoices):
        """Hạng hiển thị của tin — quyết định nền card + thứ tự ưu tiên trong danh sách.

        Admin gán qua Django admin; về sau (giai đoạn gói dịch vụ NTD) sẽ gán
        tự động theo gói đã mua. Tách riêng khỏi các nhãn HOT/GẤP vì hạng là
        single-choice còn nhãn gắn kèm được nhiều cái cùng lúc.
        """

        STANDARD = 'standard', 'Tin thường'
        FEATURED = 'featured', 'Tin nổi bật'
        TOP = 'top', 'Tin TOP'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    employer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='jobs')
    employer_profile = models.ForeignKey('employers.EmployerProfile', on_delete=models.CASCADE, related_name='jobs')
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField()
    requirements = models.TextField(blank=True)
    benefits = models.TextField(blank=True)
    work_schedule_note = models.TextField(
        blank=True,
        help_text='Mô tả lịch không thể hiện hết bằng các khung giờ có cấu trúc.',
    )
    work_type = models.CharField(max_length=50, choices=WorkType.choices, blank=True)
    employment_type = models.CharField(max_length=50, choices=EmploymentType.choices, blank=True)
    experience_years = models.CharField(max_length=20, choices=ExperienceYears.choices, blank=True, help_text='Số năm kinh nghiệm yêu cầu (bộ lọc "Kinh nghiệm")')
    position_level = models.CharField(max_length=30, choices=PositionLevel.choices, blank=True, help_text='Cấp bậc tuyển dụng (bộ lọc "Cấp bậc")')
    # Minimum education required; interpreted as "từ <level> trở lên". Blank = unspecified.
    education_level = models.CharField(max_length=50, choices=EducationLevel.choices, blank=True)
    gender_requirement = models.CharField(
        max_length=20,
        choices=GenderRequirement.choices,
        default=GenderRequirement.ANY,
    )
    age_min = models.PositiveSmallIntegerField(null=True, blank=True)
    age_max = models.PositiveSmallIntegerField(null=True, blank=True)
    number_of_vacancies = models.PositiveIntegerField(null=True, blank=True, help_text='Số lượng cần tuyển; null = không giới hạn')
    salary_type = models.CharField(
        max_length=20,
        choices=SalaryType.choices,
        default=SalaryType.NEGOTIABLE,
    )
    salary_min = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=20, default='VND')
    deadline = models.DateField(null=True, blank=True)
    # Hạng tin + nhãn dịch vụ (admin gán). Nhãn "xác thực" không lưu ở đây vì
    # suy ra từ employer_profile.verified_at; nhãn "Mới"/"Sắp hết hạn" tính từ ngày.
    tier = models.CharField(max_length=20, choices=Tier.choices, default=Tier.STANDARD)
    is_hot = models.BooleanField(default=False, help_text='Nhãn HOT (đỏ) trên card')
    is_urgent = models.BooleanField(default=False, help_text='Nhãn GẤP / tuyển gấp (cam) trên card')
    has_flash_badge = models.BooleanField(default=False, help_text='Huy hiệu Sấm Chớp — NTD tương tác nhanh')
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.DRAFT)
    view_count = models.IntegerField(default=0)
    application_count = models.IntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['employer']),
            models.Index(fields=['work_type']),
            models.Index(fields=['employment_type']),
            models.Index(fields=['experience_years']),
            models.Index(fields=['position_level']),
            models.Index(fields=['education_level']),
            models.Index(fields=['status', 'published_at']),
            models.Index(fields=['employer', 'status', '-created_at']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'pending', 'active', 'closed', 'rejected']),
                name='chk_jobs_status',
            ),
            models.CheckConstraint(
                check=(models.Q(age_min__isnull=True) | models.Q(age_min__gte=15, age_min__lte=100)),
                name='chk_jobs_age_min_range',
            ),
            models.CheckConstraint(
                check=(models.Q(age_max__isnull=True) | models.Q(age_max__gte=15, age_max__lte=100)),
                name='chk_jobs_age_max_range',
            ),
            models.CheckConstraint(
                check=(
                    models.Q(age_min__isnull=True)
                    | models.Q(age_max__isnull=True)
                    | models.Q(age_max__gte=models.F('age_min'))
                ),
                name='chk_jobs_age_order',
            ),
            models.CheckConstraint(
                check=(models.Q(number_of_vacancies__isnull=True) | models.Q(number_of_vacancies__gte=1)),
                name='chk_jobs_vacancies_positive',
            ),
            models.CheckConstraint(
                check=(
                    ~models.Q(salary_type='range')
                    | (
                        models.Q(salary_min__isnull=False, salary_max__isnull=False)
                        & models.Q(salary_max__gte=models.F('salary_min'))
                    )
                ),
                name='chk_jobs_salary_range',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jb')
        if not self.slug:
            base_slug = slugify(self.title)
            self.slug = f'{base_slug}-{self.public_id}'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class JobCategoryAssignment(models.Model):
    """One primary specialization and optional domain knowledge tags."""

    class Role(models.TextChoices):
        PRIMARY_SPECIALIZATION = 'primary_specialization', 'Vị trí chuyên môn chính'
        DOMAIN_KNOWLEDGE = 'domain_knowledge', 'Kiến thức chuyên ngành'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='category_assignments')
    category = models.ForeignKey(JobCategory, on_delete=models.PROTECT, related_name='job_assignments')
    role = models.CharField(max_length=30, choices=Role.choices)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['job', 'category', 'role'], name='uq_job_category_assignment'),
            models.UniqueConstraint(
                fields=['job'],
                condition=models.Q(role='primary_specialization'),
                name='uq_job_primary_specialization',
            ),
        ]
        indexes = [models.Index(fields=['category', 'role', 'job'])]


class JobLocation(models.Model):
    """A workplace address; new writes require a ward, legacy province links are preserved."""

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_locations')
    location = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        related_name='job_workplaces',
    )
    address_detail = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['job', 'location', 'address_detail'], name='uq_job_location_address'),
        ]
        indexes = [models.Index(fields=['location', 'job'])]


class JobWorkSchedule(models.Model):
    """One structured weekday/time range for a job posting."""

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='work_schedules')
    weekday_from = models.PositiveSmallIntegerField(null=True, blank=True)
    weekday_to = models.PositiveSmallIntegerField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_overnight = models.BooleanField(default=False)
    note = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.CheckConstraint(
                check=(models.Q(weekday_from__isnull=True) | models.Q(weekday_from__range=(1, 7))),
                name='chk_job_schedule_weekday_from',
            ),
            models.CheckConstraint(
                check=(models.Q(weekday_to__isnull=True) | models.Q(weekday_to__range=(1, 7))),
                name='chk_job_schedule_weekday_to',
            ),
        ]


class Benefit(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    icon = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class JobBenefit(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_benefits')
    benefit = models.ForeignKey(Benefit, on_delete=models.PROTECT, related_name='job_assignments')
    note = models.CharField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['job', 'benefit'], name='uq_job_benefit')]


class Language(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class JobLanguageRequirement(models.Model):
    class ProficiencyLevel(models.TextChoices):
        BASIC = 'basic', 'Cơ bản'
        CONVERSATIONAL = 'conversational', 'Giao tiếp'
        WORKING = 'working', 'Làm việc'
        PROFESSIONAL = 'professional', 'Thành thạo'
        NATIVE = 'native', 'Bản ngữ'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='language_requirements')
    language = models.ForeignKey(Language, on_delete=models.PROTECT, related_name='job_requirements')
    proficiency_level = models.CharField(max_length=30, choices=ProficiencyLevel.choices, blank=True)
    certificate = models.CharField(max_length=255, blank=True)
    note = models.CharField(max_length=500, blank=True)
    is_required = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['job', 'language'], name='uq_job_language')]
        indexes = [models.Index(fields=['language', 'proficiency_level'])]


class JobApplicationContact(models.Model):
    """Internal notification recipient; never expose through public job APIs."""

    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name='application_contact')
    recipient_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.recipient_name} - {self.job}'


class JobApplicationEmail(models.Model):
    contact = models.ForeignKey(JobApplicationContact, on_delete=models.CASCADE, related_name='emails')
    email = models.EmailField()
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['contact', 'email'], name='uq_job_contact_email')]


class SavedJob(models.Model):
    """Tin ứng viên bấm lưu (nút trái tim trên job card, panel "Việc làm đã lưu")."""

    candidate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_jobs')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='saved_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'job'], name='uq_saved_jobs_candidate_job'),
        ]
        indexes = [
            models.Index(fields=['candidate', '-created_at']),
        ]

    def __str__(self):
        return f'{self.candidate_id} - {self.job_id}'


class JobSkill(models.Model):
    """Skills required by a job posting (DB doc section 2.13)."""

    class Importance(models.TextChoices):
        REQUIRED = 'required', 'Required'
        PREFERRED = 'preferred', 'Preferred'

    class MinLevel(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_skills')
    skill = models.ForeignKey('skills.Skill', on_delete=models.CASCADE, related_name='job_skills')
    importance = models.CharField(max_length=50, choices=Importance.choices, default=Importance.REQUIRED)
    weight = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)
    min_level = models.CharField(max_length=50, choices=MinLevel.choices, blank=True)
    min_years_experience = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['job', 'skill'], name='uq_job_skills_job_skill'),
        ]

    def __str__(self):
        return f'{self.job_id} - {self.skill.name}'
