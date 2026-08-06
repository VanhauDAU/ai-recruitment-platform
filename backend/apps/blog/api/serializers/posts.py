import math
import re

from django.conf import settings
from django.utils.html import strip_tags
from django.utils.text import Truncator
from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import BlogMediaAsset, PinnedPost, Post, PostCategory, Tag

DEFAULT_AUTHOR_NAME = 'Biên tập ProCV'
WORDS_PER_MINUTE = 200


class BlogMediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by = serializers.SerializerMethodField()

    class Meta:
        model = BlogMediaAsset
        fields = [
            'public_id',
            'url',
            'original_name',
            'content_type',
            'size',
            'uploaded_by',
            'created_at',
        ]

    def get_url(self, obj):
        return media_url_from_value(obj.storage_key, request=self.context.get('request'))

    def get_uploaded_by(self, obj):
        if not obj.uploaded_by:
            return None
        return obj.uploaded_by.full_name or obj.uploaded_by.email


class PostCategorySerializer(serializers.ModelSerializer):
    """Category link DTO used by navigation, cards, and post detail."""

    class Meta:
        model = PostCategory
        fields = ['name', 'slug', 'description', 'seo_title']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['name', 'slug']


class PostListSerializer(serializers.ModelSerializer):
    """Card bài viết: ảnh thumb, tiêu đề, excerpt từ phần đầu nội dung và ngày."""

    category = PostCategorySerializer(read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    excerpt = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'public_id',
            'title',
            'slug',
            'excerpt',
            'thumbnail_url',
            'category',
            'published_at',
        ]

    def get_thumbnail_url(self, obj):
        return media_url_from_value(obj.thumbnail_url, request=self.context.get('request'))

    def get_excerpt(self, obj):
        if obj.summary.strip():
            return obj.summary
        # Nội dung là rich-text HTML; lấy phần văn bản đầu để card phản ánh đúng
        # bài viết thay vì phải duy trì một trường summary riêng.
        html = re.sub(r'</(?:p|div|h[1-6]|li|br)\s*>', ' ', obj.content or '', flags=re.IGNORECASE)
        text = ' '.join(strip_tags(html).split())
        return Truncator(text).chars(220, truncate='...')


class PostDetailSerializer(serializers.ModelSerializer):
    """Chi tiết bài viết: nội dung HTML, thẻ, danh mục, danh mục việc làm liên quan."""

    category = PostCategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    related_job_category = serializers.SerializerMethodField()
    speech_default = serializers.SerializerMethodField()
    speech_assets = serializers.SerializerMethodField()
    related_posts = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'public_id',
            'title',
            'slug',
            'thumbnail_url',
            'content',
            'summary',
            'category',
            'tags',
            'related_job_category',
            'related_posts',
            'author',
            'reading_time_minutes',
            'speech_default',
            'speech_assets',
            'published_at',
            'seo_title',
            'seo_description',
        ]

    def get_thumbnail_url(self, obj):
        return media_url_from_value(obj.thumbnail_url, request=self.context.get('request'))

    def get_related_job_category(self, obj):
        if not obj.related_job_category_id:
            return None
        cat = obj.related_job_category
        return {'id': cat.id, 'name': cat.name, 'slug': cat.slug}

    def get_related_posts(self, obj):
        related = getattr(obj, 'prefetched_related_posts', None)
        if related is None:
            related = self.context.get('related_posts') or []
        return PostListSerializer(related, many=True, context=self.context).data

    def get_author(self, obj):
        author = getattr(obj, 'author', None)
        if author is None:
            return {'name': DEFAULT_AUTHOR_NAME}
        name = (author.full_name or '').strip() or (author.email or '').strip()
        return {'name': name or DEFAULT_AUTHOR_NAME}

    def get_reading_time_minutes(self, obj):
        html = re.sub(
            r'</(?:p|div|h[1-6]|li|br)\s*>',
            ' ',
            obj.content or '',
            flags=re.IGNORECASE,
        )
        words = len(strip_tags(html).split())
        if words <= 0:
            return 1
        return max(1, math.ceil(words / WORDS_PER_MINUTE))

    def get_speech_default(self, obj):
        assets = self._current_speech_assets(obj)
        asset = next(
            (
                item
                for item in assets
                if item.voice_id == settings.SPEECH_DEFAULT_VOICE_ID
                and item.style == settings.SPEECH_DEFAULT_STYLE
            ),
            None,
        )
        if asset is None:
            return None
        return self._speech_asset_payload(asset)

    def get_speech_assets(self, obj):
        return [self._speech_asset_payload(asset) for asset in self._current_speech_assets(obj)]

    @staticmethod
    def _current_speech_assets(obj):
        assets = getattr(obj, 'prefetched_ready_speech_assets', ())
        return [item for item in assets if item.post_revision == obj.edit_revision]

    def _speech_asset_payload(self, asset):
        return {
            'status': 'ready',
            'url': media_url_from_value(asset.storage_key, request=self.context.get('request')),
            'voice_id': asset.voice_id,
            'style': asset.style,
            'mime_type': asset.mime_type,
            'duration_ms': asset.duration_ms,
        }


class PinnedPostSerializer(serializers.ModelSerializer):
    """Item khối "Tài liệu hỗ trợ tìm việc" — lấy tiêu đề/slug từ bài thật."""

    title = serializers.CharField(source='post.title', read_only=True)
    slug = serializers.CharField(source='post.slug', read_only=True)

    class Meta:
        model = PinnedPost
        fields = ['title', 'slug']
