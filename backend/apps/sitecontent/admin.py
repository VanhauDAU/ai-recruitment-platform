from django import forms
from django.contrib import admin

from common.storage.media import delete_local_media_url, save_image_upload

from .models import Banner, Feedback, LinkGroup, LinkItem, SiteSetting


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    """Chỉ để tra cứu: sửa giá trị qua trang Cấu hình hệ thống (có kiểm tra và audit)."""

    list_display = ['label', 'key', 'group', 'section', 'is_public', 'updated_at']
    list_filter = ['group', 'is_public']
    search_fields = ['key', 'label']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class LinkItemInline(admin.TabularInline):
    model = LinkItem
    extra = 1
    fields = ['label', 'url', 'order', 'is_active']


@admin.register(LinkGroup)
class LinkGroupAdmin(admin.ModelAdmin):
    list_display = ['title', 'key', 'placement', 'source', 'order', 'is_active']
    list_filter = ['placement', 'source', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['key', 'title']
    inlines = [LinkItemInline]

    def get_inlines(self, request, obj=None):
        # Cụm tự sinh từ DB không dùng link nhập tay -> ẩn inline cho gọn.
        if obj and obj.source != LinkGroup.Source.MANUAL:
            return []
        return [LinkItemInline]


class BannerAdminForm(forms.ModelForm):
    upload_image = forms.FileField(
        required=False,
        help_text='Upload ảnh vào storage nội bộ. Nếu có file mới, hệ thống sẽ cập nhật image_url.',
    )

    class Meta:
        model = Banner
        fields = [
            'placement',
            'kind',
            'company',
            'eyebrow',
            'title',
            'subtitle',
            'image_url',
            'theme',
            'cta_label',
            'cta_url',
            'cta_secondary_label',
            'cta_secondary_url',
            'order',
            'is_active',
            'starts_at',
            'ends_at',
        ]


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    form = BannerAdminForm
    list_display = ['__str__', 'placement', 'kind', 'order', 'is_active', 'starts_at', 'ends_at']
    list_filter = ['placement', 'kind', 'is_active']
    raw_id_fields = ['company']
    list_editable = ['order', 'is_active']
    search_fields = ['title', 'eyebrow']
    fields = [
        'placement',
        'kind',
        'company',
        'eyebrow',
        'title',
        'subtitle',
        'upload_image',
        'image_url',
        'theme',
        'cta_label',
        'cta_url',
        'cta_secondary_label',
        'cta_secondary_url',
        'order',
        'is_active',
        'starts_at',
        'ends_at',
    ]

    def save_model(self, request, obj, form, change):
        upload = form.cleaned_data.get('upload_image')
        old_url = (
            Banner.objects.filter(pk=obj.pk).values_list('image_url', flat=True).first()
            if change
            else ''
        )
        if upload:
            saved = save_image_upload(upload, 'site/banners', request=request)
            obj.image_url = saved['path']
        super().save_model(request, obj, form, change)
        if old_url != obj.image_url:
            delete_local_media_url(old_url)


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = [
        'created_at',
        'category',
        'short_content',
        'satisfaction',
        'phone',
        'email',
        'user',
        'status',
    ]
    list_filter = ['status', 'category', 'satisfaction', 'created_at']
    list_editable = ['status']
    search_fields = ['content', 'email', 'phone']
    readonly_fields = [
        'user',
        'category',
        'content',
        'satisfaction',
        'phone',
        'email',
        'page_url',
        'created_at',
    ]

    def has_add_permission(self, request):
        return False

    @admin.display(description='Nội dung')
    def short_content(self, obj):
        return obj.content[:80] + ('…' if len(obj.content) > 80 else '')
