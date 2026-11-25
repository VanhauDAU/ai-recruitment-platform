from django.contrib import admin
from django.core.exceptions import ValidationError

from .models import (
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
    SavedJob,
)


@admin.register(JobCategory)
class JobCategoryLookupAdmin(admin.ModelAdmin):
    """Chỉ phục vụ ô autocomplete ngành nghề của các trang admin khác.

    Thêm, sửa, ẩn ngành nghề làm ở trang Danh mục dữ liệu của cổng quản trị (có kiểm
    tra cấp và ghi audit), nên ở đây chỉ được xem.
    """

    list_display = ['name', 'category_type', 'status']
    list_filter = ['category_type', 'status']
    search_fields = ['name']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class JobSkillInline(admin.TabularInline):
    model = JobSkill
    extra = 0


class JobCategoryAssignmentInline(admin.TabularInline):
    model = JobCategoryAssignment
    extra = 0


class JobLocationInline(admin.TabularInline):
    model = JobLocation
    extra = 0


class JobWorkScheduleInline(admin.TabularInline):
    model = JobWorkSchedule
    extra = 0


class JobBenefitInline(admin.TabularInline):
    model = JobBenefit
    extra = 0


class JobLanguageRequirementInline(admin.TabularInline):
    model = JobLanguageRequirement
    extra = 0


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    ordering = ('-created_at', '-id')
    list_display = [
        'title',
        'company',
        'status',
        'tier',
        'is_hot',
        'is_urgent',
        'has_flash_badge',
        'created_at',
    ]
    list_filter = [
        'status',
        'tier',
        'is_hot',
        'is_urgent',
        'has_flash_badge',
        'work_type',
        'employment_type',
        'position_level',
        'experience_years',
        'education_level',
        'gender_requirement',
        'salary_type',
    ]
    # Gán hạng tin + nhãn ngay trên danh sách, không cần mở từng job. Huy hiệu
    # Sấm Chớp do hệ thống tính (ADR-0027) nên chỉ xem.
    list_editable = ['tier', 'is_hot', 'is_urgent']
    search_fields = ['title', 'company__company_name']
    readonly_fields = [
        'public_id',
        'has_flash_badge',
        'submitted_at',
        'approved_at',
        'published_at',
        'impression_count',
        'view_count',
        'application_count',
        'engagement_tracking_started_at',
    ]
    inlines = [
        JobCategoryAssignmentInline,
        JobLocationInline,
        JobWorkScheduleInline,
        JobSkillInline,
        JobBenefitInline,
        JobLanguageRequirementInline,
    ]
    fieldsets = (
        (
            'Thông tin tuyển dụng',
            {
                'fields': (
                    'title',
                    'slug',
                    'posted_by',
                    'company',
                    'status',
                    'tier',
                    'is_hot',
                    'is_urgent',
                    'has_flash_badge',
                )
            },
        ),
        ('Mốc đăng tin', {'fields': ('submitted_at', 'approved_at', 'published_at')}),
        (
            'Mô tả hiển thị trên trang chi tiết',
            {
                'fields': ('description', 'requirements', 'benefits', 'work_schedule_note'),
                'description': 'Các trường nội dung có thể nhập HTML từ rich-text editor; trang ứng viên chỉ render tập thẻ an toàn.',
            },
        ),
        (
            'Điều kiện và đãi ngộ',
            {
                'fields': (
                    'work_type',
                    'employment_type',
                    'experience_years',
                    'education_level',
                    'position_level',
                    'gender_requirement',
                    'age_min',
                    'age_max',
                    'number_of_vacancies',
                    'salary_type',
                    'salary_min',
                    'salary_max',
                    'currency',
                    'deadline',
                )
            },
        ),
        (
            'Thống kê',
            {
                'fields': (
                    'public_id',
                    'impression_count',
                    'view_count',
                    'application_count',
                    'engagement_tracking_started_at',
                )
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        previous = Job.objects.filter(pk=obj.pk).values('status').first() if change else None
        if not previous and obj.status != Job.Status.DRAFT:
            raise ValidationError('Tin tạo trong trang quản trị phải bắt đầu ở trạng thái nháp.')
        if previous and obj.status != previous['status']:
            raise ValidationError(
                'Trạng thái tin do nhà tuyển dụng thay đổi. '
                'Dùng trang quản lý tin để tạm ẩn hoặc khôi phục hiển thị.'
            )
        super().save_model(request, obj, form, change)


@admin.register(JobSkill)
class JobSkillAdmin(admin.ModelAdmin):
    list_display = ['job', 'skill', 'importance', 'weight']
    list_filter = ['importance']


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'job', 'created_at']
    search_fields = ['candidate__email', 'job__title']
    autocomplete_fields = ['job']
    readonly_fields = ['created_at']


class JobApplicationEmailInline(admin.TabularInline):
    model = JobApplicationEmail
    extra = 0
    max_num = 5


@admin.register(JobApplicationContact)
class JobApplicationContactAdmin(admin.ModelAdmin):
    list_display = ['job', 'recipient_name', 'phone']
    search_fields = ['job__title', 'recipient_name', 'phone', 'emails__email']
    inlines = [JobApplicationEmailInline]
