import re

from rest_framework import serializers
from django.utils.html import strip_tags
from django.utils.text import Truncator

from common.media_storage import media_url_from_value

from .models import PinnedPost, Post, PostCategory, Tag


class PostCategorySerializer(serializers.ModelSerializer):
    """Category link DTO used by navigation, cards, and post detail."""

    class Meta:
        model = PostCategory
        fields = ['name', 'slug']


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

    class Meta:
        model = Post
        fields = [
            'public_id',
            'title',
            'slug',
            'thumbnail_url',
            'content',
            'category',
            'tags',
            'related_job_category',
            'published_at',
            'seo_title',
        ]

    def get_thumbnail_url(self, obj):
        return media_url_from_value(obj.thumbnail_url, request=self.context.get('request'))

    def get_related_job_category(self, obj):
        if not obj.related_job_category_id:
            return None
        cat = obj.related_job_category
        return {'id': cat.id, 'name': cat.name, 'slug': cat.slug}


class PinnedPostSerializer(serializers.ModelSerializer):
    """Item khối "Tài liệu hỗ trợ tìm việc" — lấy tiêu đề/slug từ bài thật."""

    title = serializers.CharField(source='post.title', read_only=True)
    slug = serializers.CharField(source='post.slug', read_only=True)

    class Meta:
        model = PinnedPost
        fields = ['title', 'slug']
