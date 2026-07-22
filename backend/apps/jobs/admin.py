from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet
from django.utils.html import format_html

from common.media_storage import delete_local_media_url, media_url_from_value, save_image_upload

from .models import (
    Benefit,
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobBenefit,
    JobCategory,
    JobCategoryAssignment,
    JobCategoryLocalization,
    JobLanguageRequirement,
    JobLocation,
    JobSkill,
    JobWorkSchedule,
    Language,
    SavedJob,
)
from .services import approve_job, reject_job


class JobCategoryAdminForm(forms.ModelForm):
    upload_logo = forms.FileField(
        required=False,
        help_text='Upload logo vào storage nội bộ. Nếu có file mới, hệ thống sẽ cập nhật logo_url.',
    )

    class Meta:
        model = JobCategory
        fields = '__all__'


class JobCategoryLocalizationInlineFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        if any(self.errors):
            return
        instance = self.instance
        if (
            instance.category_type != JobCategory.CategoryType.SPECIALIZATION
            or instance.status != JobCategory.Status.ACTIVE
        ):
            return
        configured_locales = {
            form.cleaned_data.get('locale')
            for form in self.forms
            if form.cleaned_data
            and not form.cleaned_data.get('DELETE')
            and form.cleaned_data.get('is_active', True)
            and form.cleaned_data.get('display_name')
        }
        required_locales = {choice[0] for choice in JobCategoryLocalization.Locale.choices}
        missing = required_locales - configured_locales
        if missing:
            raise ValidationError(
                f'Vị trí active phải có đủ 4 ngôn ngữ. Còn thiếu: {", ".join(sorted(missing))}.'
            )


class JobCategoryLocalizationInline(admin.TabularInline):
    model = JobCategoryLocalization
    formset = JobCategoryLocalizationInlineFormSet
    extra = 0
    fields = ['locale', 'display_name', 'search_aliases', 'is_active']

    def get_extra(self, request, obj=None, **kwargs):
        return 4 if obj is None else 0


@admin.register(JobCategory)
class JobCategoryAdmin(admin.ModelAdmin):
    form = JobCategoryAdminForm
    list_display = [
        'name',
        'category_type',
        'parent',
        'cv_locale_readiness',
        'logo_preview',
        'status',
    ]
    list_filter = ['category_type', 'status']
    search_fields = ['name', 'logo_url']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['public_id', 'logo_preview']
    inlines = [JobCategoryLocalizationInline]
    fieldsets = (
        (
            None,
            {
                'fields': (
                    'public_id',
                    'name',
                    'slug',
                    'description',
                    'parent',
                    'category_type',
                    'status',
                )
            },
        ),
        ('Homepage display', {'fields': ('upload_logo', 'logo_url', 'logo_preview')}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('localizations')

    def save_model(self, request, obj, form, change):
        upload = form.cleaned_data.get('upload_logo')
        old_url = (
            JobCategory.objects.filter(pk=obj.pk).values_list('logo_url', flat=True).first()
            if change
            else ''
        )
        if upload:
            saved = save_image_upload(upload, 'jobs/categories/logos', request=request)
            obj.logo_url = saved['path']
        super().save_model(request, obj, form, change)
        if old_url != obj.logo_url:
            delete_local_media_url(old_url)

    @admin.display(description='Logo')
    def logo_preview(self, obj):
        if not obj.logo_url:
            return '-'
        return format_html(
            '<img src="{}" alt="{}" style="height: 36px; max-width: 72px; object-fit: contain;" />',
            media_url_from_value(obj.logo_url, request=None),
            obj.name,
        )

    @admin.display(description='CV locales')
    def cv_locale_readiness(self, obj):
        if obj.category_type != JobCategory.CategoryType.SPECIALIZATION:
            return '-'
        active_locales = {item.locale for item in obj.localizations.all() if item.is_active}
        required = {choice[0] for choice in JobCategoryLocalization.Locale.choices}
        return '4/4' if active_locales >= required else f'{len(active_locales & required)}/4'


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
    # Gán hạng tin + nhãn ngay trên danh sách, không cần mở từng job.
    list_editable = ['tier', 'is_hot', 'is_urgent', 'has_flash_badge']
    search_fields = ['title', 'company__company_name']
    readonly_fields = [
        'public_id',
        'submitted_at',
        'approved_at',
        'published_at',
        'impression_count',
        'view_count',
        'application_count',
        'engagement_tracking_started_at',
    ]
    actions = ['approve_selected_jobs']
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
                    'rejected_reason',
                    'tier',
                    'is_hot',
                    'is_urgent',
                    'has_flash_badge',
                )
            },
        ),
        ('Duyệt tin', {'fields': ('submitted_at', 'approved_at', 'published_at')}),
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

    @admin.action(description='Duyệt các tin đã chọn')
    def approve_selected_jobs(self, request, queryset):
        approved = 0
        for job in queryset.filter(status=Job.Status.PENDING):
            approve_job(job=job, user=request.user)
            approved += 1
        self.message_user(request, f'Đã duyệt {approved} tin.')

    def save_model(self, request, obj, form, change):
        previous = Job.objects.filter(pk=obj.pk).values('status').first() if change else None
        desired_status = obj.status
        if not previous and desired_status != Job.Status.DRAFT:
            raise ValidationError('Tin tạo trong trang quản trị phải bắt đầu ở trạng thái nháp.')
        if previous and desired_status != previous['status']:
            if previous['status'] != Job.Status.PENDING:
                raise ValidationError('Chỉ tin đang chờ duyệt mới được chuyển trạng thái tại đây.')
            if desired_status not in {Job.Status.ACTIVE, Job.Status.REJECTED}:
                raise ValidationError('Chỉ có thể duyệt hoặc từ chối tin đang chờ duyệt.')
            if desired_status == Job.Status.REJECTED and not obj.rejected_reason.strip():
                raise ValidationError('Nhập lý do từ chối để nhà tuyển dụng có thể chỉnh sửa tin.')
            obj.status = Job.Status.PENDING
        super().save_model(request, obj, form, change)
        if (
            previous
            and previous['status'] == Job.Status.PENDING
            and desired_status == Job.Status.REJECTED
        ):
            reject_job(job=obj, user=request.user, reason=obj.rejected_reason)
        elif (
            previous
            and previous['status'] == Job.Status.PENDING
            and desired_status == Job.Status.ACTIVE
        ):
            # Keep manual status updates in Django admin consistent with the
            # review service, including approval timestamps and history.
            approve_job(job=obj, user=request.user)


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


@admin.register(Benefit)
class BenefitAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'sort_order']
    list_editable = ['is_active', 'sort_order']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    prepopulated_fields = {'slug': ('name',)}


class JobApplicationEmailInline(admin.TabularInline):
    model = JobApplicationEmail
    extra = 0
    max_num = 5


@admin.register(JobApplicationContact)
class JobApplicationContactAdmin(admin.ModelAdmin):
    list_display = ['job', 'recipient_name', 'phone']
    search_fields = ['job__title', 'recipient_name', 'phone', 'emails__email']
    inlines = [JobApplicationEmailInline]
