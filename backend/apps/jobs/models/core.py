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

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    logo_url = models.TextField(
        blank=True,
        help_text='Storage key nội bộ hoặc URL ngoài; API tự resolve storage key thành URL public.',
    )
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children'
    )
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
        if not self.public_id:
            self.public_id = generate_public_id('jobcat')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class JobCategoryLocalization(models.Model):
    """Admin-managed display/search text for one taxonomy node and locale."""

    class Locale(models.TextChoices):
        VI = 'vi-VN', 'Tiếng Việt'
        EN = 'en-US', 'Tiếng Anh'
        JA = 'ja-JP', 'Tiếng Nhật'
        ZH = 'zh-CN', 'Tiếng Trung'

    category = models.ForeignKey(
        JobCategory,
        on_delete=models.CASCADE,
        related_name='localizations',
    )
    # Compatibility code kept during the staged locale migration. New code
    # writes both this field and locale_ref until the cleanup release.
    locale = models.CharField(max_length=16)
    locale_ref = models.ForeignKey(
        'sitecontent.Locale',
        to_field='code',
        db_column='locale_ref_code',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='job_category_localizations',
    )
    display_name = models.CharField(max_length=255)
    search_aliases = models.TextField(
        blank=True, help_text='Các từ khóa tìm kiếm, phân tách bằng dấu phẩy.'
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['locale', 'is_active', 'sort_order'], name='idx_jobcatloc_picker'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'locale'], name='uq_job_category_localization'
            ),
        ]
        ordering = ['locale', 'sort_order', 'display_name', 'category_id']

    def __str__(self):
        return f'{self.category.name} ({self.locale})'

    def save(self, *args, **kwargs):
        from apps.sitecontent.models import Locale as SiteLocale

        self.locale_ref_id = (
            self.locale if SiteLocale.objects.filter(code=self.locale).exists() else None
        )
        super().save(*args, **kwargs)


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
        WORK_FROM_HOME = 'work_from_home', 'Làm tại nhà (việc làm phổ thông)'
        INTERNSHIP = 'internship', 'Internship'
        FREELANCE = 'freelance', 'Freelance'
        OTHER = 'other', 'Khác'

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

    class IncomeDisplayType(models.TextChoices):
        INCOME = 'income', 'Thu nhập'
        INCOME_AT_KPI = 'income_at_kpi', 'Thu nhập khi đạt 100% KPI'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        PENDING = 'pending', 'Chờ duyệt'
        ACTIVE = 'active', 'Đang tuyển'
        CLOSED = 'closed', 'Đã đóng'
        REJECTED = 'rejected', 'Từ chối'

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
    # Tin thuộc về công ty; posted_by là HR cụ thể đã đăng (nhiều HR/công ty).
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posted_jobs'
    )
    company = models.ForeignKey('employers.Company', on_delete=models.CASCADE, related_name='jobs')
    campaign = models.ForeignKey(
        'employers.RecruitmentCampaign',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='jobs',
    )
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
    work_types = models.JSONField(
        default=list,
        blank=True,
        help_text='Các hình thức làm việc được áp dụng; work_type giữ giá trị đầu tiên để tương thích bộ lọc cũ.',
    )
    employment_type = models.CharField(max_length=50, choices=EmploymentType.choices, blank=True)
    experience_years = models.CharField(
        max_length=20,
        choices=ExperienceYears.choices,
        blank=True,
        help_text='Số năm kinh nghiệm yêu cầu (bộ lọc "Kinh nghiệm")',
    )
    position_level = models.CharField(
        max_length=30,
        choices=PositionLevel.choices,
        blank=True,
        help_text='Cấp bậc tuyển dụng (bộ lọc "Cấp bậc")',
    )
    # Minimum education required; interpreted as "từ <level> trở lên". Blank = unspecified.
    education_level = models.CharField(max_length=50, choices=EducationLevel.choices, blank=True)
    gender_requirement = models.CharField(
        max_length=20,
        choices=GenderRequirement.choices,
        default=GenderRequirement.ANY,
    )
    age_min = models.PositiveSmallIntegerField(null=True, blank=True)
    age_max = models.PositiveSmallIntegerField(null=True, blank=True)
    number_of_vacancies = models.PositiveIntegerField(
        null=True, blank=True, help_text='Số lượng cần tuyển; null = không giới hạn'
    )
    salary_type = models.CharField(
        max_length=20,
        choices=SalaryType.choices,
        default=SalaryType.NEGOTIABLE,
        null=True,
        blank=True,
    )
    salary_min = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    income_display_type = models.CharField(
        max_length=30,
        choices=IncomeDisplayType.choices,
        default=IncomeDisplayType.INCOME,
    )
    currency = models.CharField(max_length=20, default='VND')
    deadline = models.DateField(null=True, blank=True)
    # Hạng tin + nhãn dịch vụ (admin gán). Nhãn "xác thực" không lưu ở đây vì
    # suy ra từ company.verified_at; nhãn "Mới"/"Sắp hết hạn" tính từ ngày.
    tier = models.CharField(max_length=20, choices=Tier.choices, default=Tier.STANDARD)
    is_hot = models.BooleanField(default=False, help_text='Nhãn HOT (đỏ) trên card')
    is_urgent = models.BooleanField(default=False, help_text='Nhãn GẤP / tuyển gấp (cam) trên card')
    has_flash_badge = models.BooleanField(
        default=False, help_text='Huy hiệu Sấm Chớp — NTD tương tác nhanh'
    )
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.DRAFT)
    view_count = models.IntegerField(default=0)
    application_count = models.IntegerField(default=0)
    submitted_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['posted_by'], name='jobs_job_posted_by_idx'),
            models.Index(fields=['work_type']),
            models.Index(fields=['employment_type']),
            models.Index(fields=['experience_years']),
            models.Index(fields=['position_level']),
            models.Index(fields=['education_level']),
            models.Index(fields=['status', 'published_at']),
            models.Index(
                fields=['company', 'status', '-created_at'], name='jobs_job_company_status_idx'
            ),
            models.Index(fields=['campaign', 'status'], name='jobs_job_campaign_status_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'pending', 'active', 'closed', 'rejected']),
                name='chk_jobs_status',
            ),
            models.CheckConstraint(
                check=(
                    models.Q(age_min__isnull=True) | models.Q(age_min__gte=15, age_min__lte=100)
                ),
                name='chk_jobs_age_min_range',
            ),
            models.CheckConstraint(
                check=(
                    models.Q(age_max__isnull=True) | models.Q(age_max__gte=15, age_max__lte=100)
                ),
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
                check=(
                    models.Q(number_of_vacancies__isnull=True)
                    | models.Q(number_of_vacancies__gte=1)
                ),
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

    @property
    def is_expired(self):
        from django.utils import timezone

        return bool(
            self.status == self.Status.ACTIVE
            and self.deadline is not None
            and self.deadline < timezone.localdate()
        )
