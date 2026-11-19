from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id
from common.vietnam_time import vietnam_day_start, vietnam_today


def validate_application_reasons(value):
    if not isinstance(value, list):
        raise ValidationError(_('Lý do nên ứng tuyển phải là một danh sách.'))
    if len(value) > 3:
        raise ValidationError(_('Chỉ được nhập tối đa 3 lý do nên ứng tuyển.'))
    normalized = []
    for item in value:
        text = item.strip() if isinstance(item, str) else ''
        if not text or len(text) > 160:
            raise ValidationError(_('Mỗi lý do phải có từ 1 đến 160 ký tự.'))
        normalized.append(text.casefold())
    if len(normalized) != len(set(normalized)):
        raise ValidationError(_('Các lý do nên ứng tuyển không được trùng nhau.'))


class Job(models.Model):
    """A job posting / Job Description (DB doc section 2.12)."""

    AUTO_REJECTION_AFTER_DAY_CHOICES = (
        (14, gettext_lazy('2 tuần')),
        (21, gettext_lazy('3 tuần')),
        (28, gettext_lazy('4 tuần')),
        (42, gettext_lazy('6 tuần')),
        (56, gettext_lazy('8 tuần')),
    )
    DEFAULT_AUTO_REJECTION_EMAIL = (
        'Cảm ơn bạn đã ứng tuyển vị trí {job_title} tại {company_name}.\n\n'
        'Sau {auto_reject_weeks} tuần kể từ ngày ứng tuyển, chúng tôi chưa thể phản hồi '
        'hồ sơ của bạn. Điều này thường có nghĩa là hồ sơ hiện chưa phù hợp với vị trí này.\n\n'
        'Tuy nhiên, thông tin của bạn đã được lưu trong hệ thống của {company_name} và nhà '
        'tuyển dụng vẫn có thể liên hệ nếu có vị trí phù hợp hơn sau này.'
    )

    class WorkType(models.TextChoices):
        ONSITE = 'onsite', 'Onsite'
        REMOTE = 'remote', 'Remote'
        HYBRID = 'hybrid', 'Hybrid'

    class EmploymentType(models.TextChoices):
        FULL_TIME = 'full_time', 'Full-time'
        PART_TIME = 'part_time', 'Part-time'
        CONTRACT = 'contract', gettext_lazy('Hợp đồng')
        SEASONAL = 'seasonal', gettext_lazy('Thời vụ')
        WORK_FROM_HOME = 'work_from_home', gettext_lazy('Làm tại nhà (việc làm phổ thông)')
        INTERNSHIP = 'internship', 'Internship'
        FREELANCE = 'freelance', 'Freelance'
        OTHER = 'other', gettext_lazy('Khác')

    class ExperienceYears(models.TextChoices):
        NONE = 'none', gettext_lazy('Không yêu cầu')
        UNDER_1 = 'under_1', gettext_lazy('Dưới 1 năm')
        ONE = '1', gettext_lazy('1 năm')
        TWO = '2', gettext_lazy('2 năm')
        THREE = '3', gettext_lazy('3 năm')
        FOUR = '4', gettext_lazy('4 năm')
        FIVE = '5', gettext_lazy('5 năm')
        OVER_5 = 'over_5', gettext_lazy('Trên 5 năm')

    class PositionLevel(models.TextChoices):
        EMPLOYEE = 'employee', gettext_lazy('Nhân viên')
        TEAM_LEAD = 'team_lead', gettext_lazy('Trưởng nhóm')
        MANAGER = 'manager', gettext_lazy('Trưởng/Phó phòng')
        SUPERVISOR = 'supervisor', gettext_lazy('Quản lý / Giám sát')
        BRANCH_MANAGER = 'branch_manager', gettext_lazy('Trưởng chi nhánh')
        VICE_DIRECTOR = 'vice_director', gettext_lazy('Phó giám đốc')
        DIRECTOR = 'director', gettext_lazy('Giám đốc')
        INTERN = 'intern', gettext_lazy('Thực tập sinh')

    class EducationLevel(models.TextChoices):
        NONE = 'none', gettext_lazy('Không yêu cầu')
        MIDDLE_SCHOOL = 'middle_school', gettext_lazy('Trung học cơ sở (Cấp 2)')
        HIGH_SCHOOL = 'high_school', gettext_lazy('Trung học phổ thông (Cấp 3)')
        INTERMEDIATE = 'intermediate', gettext_lazy('Trung cấp')
        COLLEGE = 'college', gettext_lazy('Cao đẳng')
        UNIVERSITY = 'university', gettext_lazy('Đại học')
        POSTGRADUATE = 'postgraduate', gettext_lazy('Cao học')

    class GenderRequirement(models.TextChoices):
        ANY = 'any', gettext_lazy('Không yêu cầu')
        MALE = 'male', gettext_lazy('Nam')
        FEMALE = 'female', gettext_lazy('Nữ')

    class SalaryType(models.TextChoices):
        NEGOTIABLE = 'negotiable', gettext_lazy('Thỏa thuận')
        RANGE = 'range', gettext_lazy('Khoảng lương')
        FIXED = 'fixed', gettext_lazy('Mức cố định')
        FROM = 'from', gettext_lazy('Từ mức')
        UP_TO = 'up_to', gettext_lazy('Đến mức')

    class IncomeDisplayType(models.TextChoices):
        INCOME = 'income', gettext_lazy('Thu nhập')
        INCOME_AT_KPI = 'income_at_kpi', gettext_lazy('Thu nhập khi đạt 100% KPI')

    class Currency(models.TextChoices):
        VND = 'VND', 'VND'
        USD = 'USD', 'USD'

    class Status(models.TextChoices):
        DRAFT = 'draft', gettext_lazy('Nháp')
        ACTIVE = 'active', gettext_lazy('Đang tuyển')
        CLOSED = 'closed', gettext_lazy('Đã đóng')

    class PolicyHold(models.TextChoices):
        NONE = '', gettext_lazy('Không giữ')
        TEMPORARY_LOCK = 'temporary_lock', gettext_lazy('Tạm giữ do khóa tài khoản')
        BAN_REVIEW = 'ban_review', gettext_lazy('Giữ để rà soát sau cấm')
        LEGACY_LOCK = 'legacy_lock', gettext_lazy('Giữ do trạng thái khóa cũ')

    class ModerationHold(models.TextChoices):
        NONE = '', gettext_lazy('Không giữ')
        MANUAL_REVIEW = 'manual_review', gettext_lazy('Tạm ẩn để rà soát nội dung')
        CONFIRMED_VIOLATION = 'confirmed_violation', gettext_lazy('Tạm ẩn do vi phạm đã xác nhận')
        # Fixable content: the owner may edit, then resubmits for review.
        CHANGES_REQUESTED = 'changes_requested', gettext_lazy('Tạm ẩn, cần chỉnh sửa theo yêu cầu')

    class Tier(models.TextChoices):
        """Hạng hiển thị của tin — quyết định nền card + thứ tự ưu tiên trong danh sách.

        Admin gán qua Django admin; về sau (giai đoạn gói dịch vụ NTD) sẽ gán
        tự động theo gói đã mua. Tách riêng khỏi các nhãn HOT/GẤP vì hạng là
        single-choice còn nhãn gắn kèm được nhiều cái cùng lúc.
        """

        STANDARD = 'standard', gettext_lazy('Tin thường')
        FEATURED = 'featured', gettext_lazy('Tin nổi bật')
        TOP = 'top', gettext_lazy('Tin TOP')

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    # Tin thuộc về công ty; posted_by là HR cụ thể đã đăng (nhiều HR/công ty).
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posted_jobs'
    )
    company = models.ForeignKey('employers.Company', on_delete=models.CASCADE, related_name='jobs')
    campaign = models.ForeignKey(
        'campaigns.RecruitmentCampaign',
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
    application_reasons = models.JSONField(
        default=list,
        blank=True,
        validators=[validate_application_reasons],
        help_text='Tối đa ba lý do có thứ tự để ứng viên cân nhắc ứng tuyển.',
    )
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
    # NULL = nhà tuyển dụng chưa chọn hình thức lương (bản nháp), khác hẳn NEGOTIABLE
    # là đã chọn "thỏa thuận"; API ghi/đọc null nên không đổi sang chuỗi rỗng.
    salary_type = models.CharField(  # noqa: DJ001
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
    currency = models.CharField(max_length=20, choices=Currency.choices, default=Currency.VND)
    deadline = models.DateField(null=True, blank=True)
    requested_visibility_days = models.PositiveSmallIntegerField(
        default=30,
        help_text='Số ngày công khai NTD yêu cầu cho public cycle hiện tại.',
    )
    first_approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Mốc duyệt đầu tiên bất biến của public cycle hiện tại.',
    )
    visibility_starts_at = models.DateTimeField(null=True, blank=True)
    visibility_ends_at = models.DateTimeField(null=True, blank=True)
    auto_reject_stale_applications = models.BooleanField(
        default=True,
        help_text='Tự chuyển hồ sơ chờ xử lý quá hạn sang trạng thái từ chối.',
    )
    auto_reject_after_days = models.PositiveSmallIntegerField(
        choices=AUTO_REJECTION_AFTER_DAY_CHOICES,
        default=21,
    )
    auto_rejection_email_body = models.TextField(
        max_length=1000,
        default=DEFAULT_AUTO_REJECTION_EMAIL,
        help_text='Nội dung email gửi ứng viên ba ngày sau khi hồ sơ bị tự động từ chối.',
    )
    # Hạng tin + nhãn dịch vụ (admin gán). Nhãn "xác thực" không lưu ở đây vì
    # được tính từ các tiêu chí của recruiter đăng tin; nhãn thời gian tính từ ngày.
    tier = models.CharField(max_length=20, choices=Tier.choices, default=Tier.STANDARD)
    is_hot = models.BooleanField(default=False, help_text='Nhãn HOT (đỏ) trên card')
    is_urgent = models.BooleanField(default=False, help_text='Nhãn GẤP / tuyển gấp (cam) trên card')
    has_flash_badge = models.BooleanField(
        default=False, help_text='Huy hiệu Sấm Chớp — NTD tương tác nhanh'
    )
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.DRAFT)
    policy_hold = models.CharField(
        max_length=24,
        choices=PolicyHold.choices,
        default=PolicyHold.NONE,
        blank=True,
    )
    policy_held_at = models.DateTimeField(null=True, blank=True)
    policy_hold_transition = models.ForeignKey(
        'accounts.AccountStatusTransition',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='held_jobs',
    )
    moderation_hold = models.CharField(
        max_length=24,
        choices=ModerationHold.choices,
        default=ModerationHold.NONE,
        blank=True,
    )
    moderation_held_at = models.DateTimeField(null=True, blank=True)
    # Set when the owner sends a job under CHANGES_REQUESTED back for review.
    moderation_resubmitted_at = models.DateTimeField(null=True, blank=True)
    # Digest of the content an administrator asked to change; a resubmit with
    # the same digest changed nothing and is refused.
    moderation_content_digest = models.CharField(max_length=64, blank=True, default='')
    view_count = models.IntegerField(default=0)
    impression_count = models.PositiveIntegerField(default=0)
    application_count = models.IntegerField(default=0)
    engagement_tracking_started_at = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    # The approved_* columns keep their names from the pre-approval era (see
    # ADR-0014). They now record the latest publication by the recruiter.
    approved_at = models.DateTimeField(null=True, blank=True)
    # Content made public by the last publication. Later edits take effect
    # immediately, so administrators diff the current content against this.
    approved_snapshot = models.JSONField(default=dict, blank=True)
    approved_snapshot_at = models.DateTimeField(null=True, blank=True)
    # Evidence that the recruiter accepted the publication commitment the last
    # time this job went public. Empty for jobs published before ADR-0014.
    responsibility_accepted_at = models.DateTimeField(null=True, blank=True)
    responsibility_statement_version = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['policy_hold', 'status'], name='jobs_hold_status_idx'),
            models.Index(
                fields=['moderation_hold', 'status'],
                name='jobs_moderation_hold_idx',
            ),
            models.Index(fields=['posted_by'], name='jobs_job_posted_by_idx'),
            models.Index(fields=['work_type']),
            models.Index(fields=['employment_type']),
            models.Index(fields=['experience_years']),
            models.Index(fields=['position_level']),
            models.Index(fields=['education_level']),
            models.Index(fields=['status', 'published_at']),
            models.Index(
                fields=['status', 'visibility_ends_at'],
                name='jobs_status_visibility_end_idx',
            ),
            models.Index(
                fields=['status', '-created_at', '-id'],
                name='jobs_status_created_desc_idx',
            ),
            models.Index(
                fields=['company', 'status', '-created_at'], name='jobs_job_company_status_idx'
            ),
            models.Index(fields=['campaign', 'status'], name='jobs_job_campaign_status_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['draft', 'active', 'closed']),
                name='chk_jobs_status',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(age_min__isnull=True) | models.Q(age_min__gte=15, age_min__lte=100)
                ),
                name='chk_jobs_age_min_range',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(age_max__isnull=True) | models.Q(age_max__gte=15, age_max__lte=100)
                ),
                name='chk_jobs_age_max_range',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(age_min__isnull=True)
                    | models.Q(age_max__isnull=True)
                    | models.Q(age_max__gte=models.F('age_min'))
                ),
                name='chk_jobs_age_order',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(number_of_vacancies__isnull=True)
                    | models.Q(number_of_vacancies__gte=1)
                ),
                name='chk_jobs_vacancies_positive',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(salary_type='range')
                    | (
                        models.Q(salary_min__isnull=False, salary_max__isnull=False)
                        & models.Q(salary_max__gte=models.F('salary_min'))
                    )
                ),
                name='chk_jobs_salary_range',
            ),
            models.CheckConstraint(
                condition=models.Q(
                    requested_visibility_days__gte=1,
                    requested_visibility_days__lte=90,
                ),
                name='chk_jobs_visibility_days_range',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(visibility_starts_at__isnull=True)
                    | models.Q(visibility_ends_at__isnull=True)
                    | models.Q(visibility_ends_at__gt=models.F('visibility_starts_at'))
                ),
                name='chk_jobs_visibility_window',
            ),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('jb')
        if not self.slug:
            base_slug = slugify(self.title)
            self.slug = f'{base_slug}-{self.public_id}'
        super().save(*args, **kwargs)

    @classmethod
    def publicly_available_queryset(cls, *, at=None):
        """Expose the canonical candidate-visible queryset across app boundaries."""
        from .querysets import publicly_available_job_filter

        return cls.objects.filter(publicly_available_job_filter(at=at))

    @property
    def is_expired(self):
        """Active but past the application deadline or the public visibility window."""
        if self.status != self.Status.ACTIVE:
            return False
        now = timezone.now()
        return bool(
            (self.deadline is not None and self.deadline < vietnam_today(now))
            or self.visibility_ends_at is None
            or self.visibility_ends_at <= now
        )

    @property
    def stopped_at(self):
        """When the job stopped recruiting, for candidates; ``None`` while it recruits."""
        if self.status == self.Status.CLOSED:
            return self.closed_at
        if self.status != self.Status.ACTIVE:
            return None
        now = timezone.now()
        ends = []
        if self.deadline is not None and self.deadline < vietnam_today(now):
            ends.append(vietnam_day_start(self.deadline + timedelta(days=1)))
        if self.visibility_ends_at is not None and self.visibility_ends_at <= now:
            ends.append(self.visibility_ends_at)
        if self.visibility_ends_at is None:
            # No display window means not public (``is_expired`` agrees); the
            # last change is the best known moment it stopped.
            ends.append(self.updated_at)
        return min(ends) if ends else None

    @property
    def editable_for_requested_changes(self):
        """Owner may still edit: changes were requested and not yet resubmitted."""
        return bool(
            not self.policy_hold
            and self.moderation_hold == self.ModerationHold.CHANGES_REQUESTED
            and self.moderation_resubmitted_at is None
        )

    @property
    def is_visibility_expired(self) -> bool:
        return bool(
            self.status == self.Status.ACTIVE
            and self.visibility_ends_at is not None
            and self.visibility_ends_at <= timezone.now()
        )
