from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class JobCategory(models.Model):
    """Industry/field taxonomy for filtering jobs (DB doc section 2.10)."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(blank=True)
    logo_url = models.TextField(blank=True, help_text='Public URL for the category logo shown on the homepage.')
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
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
        INTERNSHIP = 'internship', 'Internship'
        FREELANCE = 'freelance', 'Freelance'

    class ExperienceLevel(models.TextChoices):
        INTERN = 'intern', 'Intern'
        FRESHER = 'fresher', 'Fresher'
        JUNIOR = 'junior', 'Junior'
        MIDDLE = 'middle', 'Middle'
        SENIOR = 'senior', 'Senior'

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

    class WeekendPolicy(models.TextChoices):
        WORK_SATURDAY = 'work_saturday', 'Làm thứ 7'
        OFF_SATURDAY = 'off_saturday', 'Nghỉ thứ 7'

    class EducationLevel(models.TextChoices):
        NONE = 'none', 'Không yêu cầu'
        HIGH_SCHOOL = 'high_school', 'THPT'
        INTERMEDIATE = 'intermediate', 'Trung cấp'
        COLLEGE = 'college', 'Cao đẳng'
        UNIVERSITY = 'university', 'Đại học'
        POSTGRADUATE = 'postgraduate', 'Sau đại học'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        CLOSED = 'closed', 'Closed'
        REJECTED = 'rejected', 'Rejected'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    employer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='jobs')
    employer_profile = models.ForeignKey('employers.EmployerProfile', on_delete=models.CASCADE, related_name='jobs')
    category = models.ForeignKey(JobCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='jobs')
    # A job can recruit at multiple locations (province and/or ward level).
    locations = models.ManyToManyField('locations.Location', related_name='jobs', blank=True)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    short_description = models.TextField(blank=True)
    description = models.TextField()
    responsibilities = models.TextField(blank=True)
    requirements = models.TextField(blank=True)
    nice_to_have = models.TextField(blank=True)
    benefits = models.TextField(blank=True)
    address = models.TextField(blank=True)
    work_type = models.CharField(max_length=50, choices=WorkType.choices, blank=True)
    employment_type = models.CharField(max_length=50, choices=EmploymentType.choices, blank=True)
    experience_level = models.CharField(max_length=50, choices=ExperienceLevel.choices, blank=True)
    experience_years = models.CharField(max_length=20, choices=ExperienceYears.choices, blank=True, help_text='Số năm kinh nghiệm yêu cầu (bộ lọc "Kinh nghiệm")')
    position_level = models.CharField(max_length=30, choices=PositionLevel.choices, blank=True, help_text='Cấp bậc tuyển dụng (bộ lọc "Cấp bậc")')
    weekend_policy = models.CharField(max_length=20, choices=WeekendPolicy.choices, blank=True, help_text='Chế độ thứ 7; để trống = tin không đề cập')
    # Minimum education required; interpreted as "từ <level> trở lên". Blank = unspecified.
    education_level = models.CharField(max_length=50, choices=EducationLevel.choices, blank=True)
    number_of_vacancies = models.PositiveIntegerField(null=True, blank=True, help_text='Số lượng cần tuyển; null = không giới hạn')
    salary_min = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=20, default='VND')
    is_salary_visible = models.BooleanField(default=True)
    deadline = models.DateField(null=True, blank=True)
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
            models.Index(fields=['experience_level']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'pending', 'active', 'closed', 'rejected']),
                name='chk_jobs_status',
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
