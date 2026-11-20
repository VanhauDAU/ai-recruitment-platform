from django import forms
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from common.storage.media import delete_local_media_url, media_url_from_value, save_image_upload

from .models import PinnedPost, Post, PostCategory, Tag


@admin.register(PostCategory)
class PostCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'order', 'is_active', 'created_at']
    list_filter = ['is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


class PostAdminForm(forms.ModelForm):
    upload_thumbnail = forms.FileField(
        required=False,
        help_text='Upload ảnh thumb vào storage nội bộ. Có file mới sẽ cập nhật thumbnail_url.',
    )

    class Meta:
        model = Post
        fields = [
            'title',
            'slug',
            'category',
            'summary',
            'status',
            'thumbnail_url',
            'content',
            'related_job_category',
            'tags',
            'seo_title',
            'seo_description',
            'author',
            'published_at',
        ]
        widgets = {
            'content': forms.Textarea(
                attrs={'rows': 24, 'style': 'font-family: monospace; width: 100%;'}
            ),
        }


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    form = PostAdminForm
    list_display = [
        'title',
        'category',
        'status',
        'author',
        'published_at',
        'view_count',
        'thumbnail_preview',
    ]
    list_filter = ['status', 'category', 'created_at']
    search_fields = ['title', 'slug', 'summary']
    prepopulated_fields = {'slug': ('title',)}
    autocomplete_fields = ['category', 'related_job_category', 'tags']
    readonly_fields = ['public_id', 'view_count', 'thumbnail_preview', 'created_at', 'updated_at']
    fieldsets = (
        (None, {'fields': ('title', 'slug', 'category', 'summary', 'status')}),
        (
            'Nội dung',
            {'fields': ('upload_thumbnail', 'thumbnail_url', 'thumbnail_preview', 'content')},
        ),
        ('Liên kết & thẻ', {'fields': ('related_job_category', 'tags')}),
        ('SEO', {'fields': ('seo_title', 'seo_description'), 'classes': ('collapse',)}),
        (
            'Hệ thống',
            {
                'fields': (
                    'public_id',
                    'author',
                    'published_at',
                    'view_count',
                    'created_at',
                    'updated_at',
                ),
                'classes': ('collapse',),
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('category', 'author')

    def save_model(self, request, obj, form, change):
        if obj.author_id is None:
            obj.author = request.user
        # Chốt thời điểm đăng lần đầu khi bài được xuất bản.
        if obj.status == Post.Status.PUBLISHED and obj.published_at is None:
            obj.published_at = timezone.now()

        upload = form.cleaned_data.get('upload_thumbnail')
        old_url = (
            Post.objects.filter(pk=obj.pk).values_list('thumbnail_url', flat=True).first()
            if change
            else ''
        )
        if upload:
            saved = save_image_upload(upload, 'blog/thumbnails', request=request)
            obj.thumbnail_url = saved['path']
        super().save_model(request, obj, form, change)
        if old_url and old_url != obj.thumbnail_url:
            delete_local_media_url(old_url)

    @admin.display(description='Thumb')
    def thumbnail_preview(self, obj):
        if not obj.thumbnail_url:
            return '-'
        return format_html(
            '<img src="{}" style="height: 48px; max-width: 96px; object-fit: cover;" />',
            media_url_from_value(obj.thumbnail_url, request=None),
        )


@admin.register(PinnedPost)
class PinnedPostAdmin(admin.ModelAdmin):
    list_display = ['placement', 'post', 'order', 'is_active']
    list_filter = ['placement', 'is_active']
    list_editable = ['order', 'is_active']
    autocomplete_fields = ['post']
