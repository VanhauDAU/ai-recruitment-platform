from django.db import models

from common.public_id import generate_public_id


class RecruitmentNeed(models.Model):
    """Nhu cầu tuyển dụng ưu tiên được khai báo sau khi xác thực email.

    Mỗi recruiter có một bản khai báo onboarding. Khi cần quản lý nhiều nhu cầu,
    workflow tuyển dụng sau này có thể tạo aggregate chiến dịch riêng từ dữ liệu
    khởi tạo này thay vì nhân bản state đăng ký.
    """

    class PositionLevel(models.TextChoices):
        EMPLOYEE = 'employee', 'Nhân viên'
        TEAM_LEAD = 'team_lead', 'Trưởng nhóm'
        MANAGER = 'manager', 'Trưởng / Phó phòng'
        SUPERVISOR = 'supervisor', 'Quản lý / Giám sát'
        BRANCH_MANAGER = 'branch_manager', 'Trưởng chi nhánh'
        VICE_DIRECTOR = 'vice_director', 'Phó giám đốc'
        DIRECTOR = 'director', 'Giám đốc'
        INTERN = 'intern', 'Thực tập sinh'

    class BudgetSource(models.TextChoices):
        COMPANY = 'company', 'Công ty'
        PERSONAL = 'personal', 'Cá nhân'

    class ConsultationTopic(models.TextChoices):
        FREE_POSTING = 'free_posting', 'Tôi muốn được đăng tin miễn phí'
        SERVICE_PACKAGES = 'service_packages', 'Tôi muốn tìm hiểu thêm về các gói dịch vụ'
        PROMOTIONS = 'promotions', 'Tôi muốn biết thêm về các chương trình ưu đãi'
        OTHER = 'other', 'Khác'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        'RecruiterProfile',
        on_delete=models.CASCADE,
        related_name='recruitment_needs',
    )
    position_category = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.PROTECT,
        related_name='employer_recruitment_needs',
    )
    position_level = models.CharField(max_length=30, choices=PositionLevel.choices)
    target_date = models.DateField(null=True, blank=True)
    is_continuous = models.BooleanField(default=False)
    headcount = models.PositiveIntegerField(default=1)
    budget_min = models.PositiveBigIntegerField(null=True, blank=True)
    budget_max = models.PositiveBigIntegerField(null=True, blank=True)
    budget_source = models.CharField(max_length=20, choices=BudgetSource.choices)
    consultation_topics = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    completed_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('need')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.recruiter_id}:{self.position_category_id}'
