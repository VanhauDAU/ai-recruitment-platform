from django.utils.text import slugify
from rest_framework import serializers

from apps.jobs.models import JobCategory
from common.media_storage import media_url_from_value

from ...models import PinnedPost, Post, PostCategory, PostStatusHistory, Tag
from ...services import sanitize_blog_html

STATE_LABELS = {
    'draft': 'Nháp',
    'pending': 'Chờ duyệt',
    'published': 'Đã xuất bản',
    'published_with_draft': 'Đã đăng · có bản sửa nháp',
    'published_with_pending': 'Đã đăng · bản sửa chờ duyệt',
    'archived': 'Đã gỡ',
}


def editorial_state(post):
    copy = getattr(post, 'working_copy', None)
    if post.status == Post.Status.PUBLISHED and copy:
        return f'published_with_{copy.status}'
    return post.status


def version_data(source, request):
    return {
        'title': source.title,
        'slug': source.post.slug if hasattr(source, 'post_id') else source.slug,
        'summary': source.summary,
        'thumbnail_url': media_url_from_value(source.thumbnail_url, request=request),
        'thumbnail_storage_key': source.thumbnail_url,
        'content': source.content,
        'category': {
            'public_id': source.category.public_id,
            'name': source.category.name,
            'slug': source.category.slug,
        },
        'tags': [
            {'public_id': tag.public_id, 'name': tag.name, 'slug': tag.slug}
            for tag in source.tags.all()
        ],
        'related_job_category': (
            {
                'id': source.related_job_category.id,
                'name': source.related_job_category.name,
                'slug': source.related_job_category.slug,
            }
            if source.related_job_category_id
            else None
        ),
        'seo_title': source.seo_title,
        'seo_description': source.seo_description,
        'status': source.status,
        'submitted_at': source.submitted_at,
        'edit_revision': source.edit_revision,
        'updated_at': source.updated_at,
    }


def completion_data(source):
    checks = {
        'title': bool(source.title.strip()),
        'summary': bool(source.summary.strip()),
        'content': bool(source.content.strip()),
        'thumbnail': bool(source.thumbnail_url.strip()),
        'related_job_category': bool(source.related_job_category_id),
        'seo_title': bool(source.seo_title.strip()),
        'seo_description': bool(source.seo_description.strip()),
    }
    completed = sum(checks.values())
    return {
        'score': round(completed / len(checks) * 100),
        'missing_fields': [key for key, ready in checks.items() if not ready],
    }


class AdminPostListSerializer(serializers.ModelSerializer):
    category = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    editorial_state = serializers.SerializerMethodField()
    editorial_state_label = serializers.SerializerMethodField()
    completeness = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'public_id',
            'title',
            'slug',
            'thumbnail_url',
            'category',
            'author',
            'status',
            'editorial_state',
            'editorial_state_label',
            'completeness',
            'allowed_actions',
            'view_count',
            'published_at',
            'updated_at',
        ]

    def get_category(self, obj):
        return {
            'public_id': obj.category.public_id,
            'name': obj.category.name,
            'slug': obj.category.slug,
        }

    def get_author(self, obj):
        if not obj.author_id:
            return None
        return {
            'public_id': obj.author.public_id,
            'name': obj.author.full_name or obj.author.email,
            'email': obj.author.email,
        }

    def get_thumbnail_url(self, obj):
        source = getattr(obj, 'working_copy', None) or obj
        return media_url_from_value(source.thumbnail_url, request=self.context.get('request'))

    def get_editorial_state(self, obj):
        return editorial_state(obj)

    def get_editorial_state_label(self, obj):
        return STATE_LABELS[editorial_state(obj)]

    def get_completeness(self, obj):
        return completion_data(getattr(obj, 'working_copy', None) or obj)

    def get_allowed_actions(self, obj):
        can_manage = self.context.get('can_manage', False)
        can_publish = self.context.get('can_publish', False)
        state = editorial_state(obj)
        editable = can_manage or can_publish
        actions = []
        if editable and state != 'archived':
            actions.extend(['edit', 'submit'])
        elif editable:
            actions.append('view')
        if can_publish and state in {'pending', 'published_with_pending'}:
            actions.extend(['return', 'publish'])
        if can_publish and state != 'archived':
            actions.append('archive')
        if editable and state == 'archived':
            actions.append('restore')
        if editable and state in {'draft', 'published_with_draft'}:
            actions.append('discard_draft')
        return actions


class AdminPostHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = PostStatusHistory
        fields = [
            'public_id',
            'action',
            'from_status',
            'to_status',
            'note',
            'actor_name',
            'created_at',
        ]

    def get_actor_name(self, obj):
        return obj.actor.full_name or obj.actor.email if obj.actor else 'Hệ thống'


class AdminPostDetailSerializer(AdminPostListSerializer):
    published_version = serializers.SerializerMethodField()
    editable_version = serializers.SerializerMethodField()
    history = AdminPostHistorySerializer(source='status_history', many=True, read_only=True)

    class Meta(AdminPostListSerializer.Meta):
        fields = [
            *AdminPostListSerializer.Meta.fields,
            'published_version',
            'editable_version',
            'history',
            'created_at',
        ]

    def get_published_version(self, obj):
        if obj.status != Post.Status.PUBLISHED:
            return None
        return version_data(obj, self.context.get('request'))

    def get_editable_version(self, obj):
        source = getattr(obj, 'working_copy', None) or obj
        return version_data(source, self.context.get('request'))


class AdminPostWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    category_public_id = serializers.SlugRelatedField(
        source='category',
        slug_field='public_id',
        queryset=PostCategory.objects.all(),
        required=False,
    )
    summary = serializers.CharField(max_length=500, required=False, allow_blank=True)
    thumbnail_storage_key = serializers.CharField(
        source='thumbnail_url', required=False, allow_blank=True, max_length=2000
    )
    content = serializers.CharField(required=False, allow_blank=True)
    related_job_category_id = serializers.PrimaryKeyRelatedField(
        source='related_job_category',
        queryset=JobCategory.objects.all(),
        required=False,
        allow_null=True,
    )
    tag_public_ids = serializers.SlugRelatedField(
        source='tags', slug_field='public_id', queryset=Tag.objects.all(), many=True, required=False
    )
    seo_title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    seo_description = serializers.CharField(max_length=300, required=False, allow_blank=True)
    base_revision = serializers.IntegerField(min_value=1, required=False)

    def validate_content(self, value):
        return sanitize_blog_html(value)

    def validate(self, attrs):
        if self.context.get('creating'):
            errors = {}
            if not attrs.get('title', '').strip():
                errors['title'] = 'Nhập tiêu đề bài viết.'
            if not attrs.get('category'):
                errors['category_public_id'] = 'Chọn danh mục bài viết.'
            if errors:
                raise serializers.ValidationError(errors)
        return attrs


class AdminPostActionSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def validate(self, attrs):
        if self.context.get('note_required') and not attrs.get('note', '').strip():
            raise serializers.ValidationError(
                {'note': 'Nhập lý do để người biên tập có thể xử lý.'}
            )
        return attrs


class AdminPostCategorySerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PostCategory
        fields = [
            'public_id',
            'name',
            'slug',
            'description',
            'seo_title',
            'order',
            'is_active',
            'post_count',
        ]
        read_only_fields = ['public_id', 'slug', 'post_count']


class AdminTagSerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True, default=0)
    working_copy_count = serializers.IntegerField(read_only=True, default=0)
    usage_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = [
            'public_id',
            'name',
            'slug',
            'is_active',
            'post_count',
            'working_copy_count',
            'usage_count',
        ]
        read_only_fields = ['public_id', 'post_count', 'working_copy_count', 'usage_count']

    def get_usage_count(self, obj):
        return getattr(obj, 'post_count', 0) + getattr(obj, 'working_copy_count', 0)

    def validate_name(self, value):
        words = value.strip().split()
        if not words:
            raise serializers.ValidationError('Nhập tên thẻ.')
        special_words = {'sales': 'Sales', 'cv': 'CV', 'seo': 'SEO', 'it': 'IT', 'hr': 'HR'}
        normalized = [special_words.get(word.casefold(), word) for word in words]
        normalized[0] = normalized[0][0].upper() + normalized[0][1:]
        value = ' '.join(normalized)
        queryset = Tag.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Đã tồn tại một thẻ có cùng tên.')
        return value

    def validate_slug(self, value):
        value = slugify(value)
        if not value:
            raise serializers.ValidationError('Slug không hợp lệ.')
        queryset = Tag.objects.filter(slug=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Slug đã được sử dụng bởi thẻ khác.')
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get('slug'):
            attrs['slug'] = slugify(attrs.get('name', ''))
            if Tag.objects.filter(slug=attrs['slug']).exists():
                raise serializers.ValidationError({'name': 'Thẻ tương tự đã tồn tại.'})
        return attrs


class AdminTagMergeSerializer(serializers.Serializer):
    target_public_id = serializers.SlugRelatedField(
        source='target',
        slug_field='public_id',
        queryset=Tag.objects.all(),
    )


class AdminPinnedPostSerializer(serializers.ModelSerializer):
    placement = serializers.ChoiceField(
        choices=PinnedPost.Placement.choices,
        default=PinnedPost.Placement.SUPPORT_DOCS,
    )
    post_public_id = serializers.SlugRelatedField(
        source='post',
        slug_field='public_id',
        queryset=Post.objects.filter(status=Post.Status.PUBLISHED),
    )
    title = serializers.CharField(source='post.title', read_only=True)
    slug = serializers.CharField(source='post.slug', read_only=True)

    class Meta:
        model = PinnedPost
        fields = ['public_id', 'placement', 'post_public_id', 'title', 'slug', 'order', 'is_active']
        read_only_fields = ['public_id', 'title', 'slug']
