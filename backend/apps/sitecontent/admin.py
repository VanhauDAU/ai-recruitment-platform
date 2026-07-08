from django.contrib import admin

from .models import Banner, LinkGroup, LinkItem, SiteSetting


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ['label', 'key', 'group', 'is_public', 'updated_at']
    list_filter = ['group', 'is_public']
    search_fields = ['key', 'label']
    list_editable = ['is_public']


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


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ['title', 'placement', 'theme', 'order', 'is_active']
    list_filter = ['placement', 'theme', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['title', 'eyebrow']
    fields = ['placement', 'eyebrow', 'title', 'subtitle', 'image_url', 'theme', 'cta_label', 'cta_url', 'order', 'is_active']
