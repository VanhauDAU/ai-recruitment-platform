import json

from django.contrib import admin
from django import forms

from apps.common.media_storage import delete_local_media_url, media_url_from_value, save_image_upload

from .models import Banner, LinkGroup, LinkItem, SiteSetting


class SiteSettingAdminForm(forms.ModelForm):
    value = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'rows': 4, 'class': 'vLargeTextField'}),
        help_text='Có thể nhập chuỗi thường như URL logo, hoặc nhập JSON nếu giá trị là object/array.',
    )

    class Meta:
        model = SiteSetting
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        value = self.instance.value if self.instance and self.instance.pk else self.initial.get('value', '')
        if isinstance(value, str):
            self.initial['value'] = value
        elif value not in (None, ''):
            self.initial['value'] = json.dumps(value, ensure_ascii=False, indent=2)

    def clean_value(self):
        raw_value = self.cleaned_data.get('value', '')
        if raw_value in (None, ''):
            return ''
        try:
            return json.loads(raw_value)
        except json.JSONDecodeError:
            return raw_value.strip()


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    form = SiteSettingAdminForm
    list_display = ['label', 'key', 'group', 'is_public', 'updated_at']
    list_filter = ['group', 'is_public']
    search_fields = ['key', 'label']
    list_editable = ['is_public']
    fieldsets = [
        (None, {'fields': ['key', 'label', 'group', 'value', 'description', 'is_public']}),
    ]


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
        fields = '__all__'


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    form = BannerAdminForm
    list_display = ['title', 'placement', 'theme', 'order', 'is_active']
    list_filter = ['placement', 'theme', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['title', 'eyebrow']
    fields = ['placement', 'eyebrow', 'title', 'subtitle', 'upload_image', 'image_url', 'theme', 'cta_label', 'cta_url', 'order', 'is_active']

    def save_model(self, request, obj, form, change):
        upload = form.cleaned_data.get('upload_image')
        old_url = Banner.objects.filter(pk=obj.pk).values_list('image_url', flat=True).first() if change else ''
        if upload:
            saved = save_image_upload(upload, 'site/banners', request=request)
            obj.image_url = saved['path']
        super().save_model(request, obj, form, change)
        if old_url != obj.image_url:
            delete_local_media_url(old_url)
