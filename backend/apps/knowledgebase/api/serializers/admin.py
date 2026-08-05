from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import (
    KnowledgeArticle,
    KnowledgeArticleRevision,
    KnowledgeCategory,
    KnowledgeMediaAsset,
)
from ...selectors import ARTICLE_ORDERING


class AdminCategorySerializer(serializers.ModelSerializer):
    article_count = serializers.IntegerField(read_only=True, default=0)
    public_article_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = KnowledgeCategory
        fields = [
            'public_id',
            'name',
            'slug',
            'description',
            'order',
            'is_active',
            'review_interval_days',
            'seo_title',
            'seo_description',
            'revision_token',
            'article_count',
            'public_article_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'revision_token',
            'article_count',
            'public_article_count',
            'created_at',
            'updated_at',
        ]


class CategoryWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    slug = serializers.SlugField(max_length=160, required=False)
    description = serializers.CharField(max_length=300, allow_blank=True, required=False)
    order = serializers.IntegerField(min_value=0, required=False)
    review_interval_days = serializers.IntegerField(min_value=30, max_value=365, required=False)
    seo_title = serializers.CharField(max_length=200, allow_blank=True, required=False)
    seo_description = serializers.CharField(max_length=300, allow_blank=True, required=False)
    revision_token = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attrs):
        if self.context.get('creating'):
            errors = {}
            for field in ('name', 'slug'):
                if not str(attrs.get(field) or '').strip():
                    errors[field] = 'Trường này là bắt buộc.'
            if errors:
                raise serializers.ValidationError(errors)
        elif 'revision_token' not in attrs:
            raise serializers.ValidationError({'revision_token': 'Trường này là bắt buộc.'})
        return attrs


class RevisionSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    submitted_by = serializers.SerializerMethodField()
    reviewed_by = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeArticleRevision
        fields = [
            'public_id',
            'number',
            'status',
            'title',
            'body',
            'body_plain_text',
            'content_hash',
            'seo_title',
            'seo_description',
            'change_summary',
            'source_reference',
            'review_note',
            'created_by',
            'submitted_by',
            'reviewed_by',
            'created_at',
            'updated_at',
            'submitted_at',
            'reviewed_at',
            'first_published_at',
        ]

    def _actor(self, actor):
        if not actor:
            return None
        return {
            'public_id': actor.public_id,
            'name': actor.full_name or actor.email,
        }

    def get_created_by(self, obj):
        return self._actor(obj.created_by)

    def get_submitted_by(self, obj):
        return self._actor(obj.submitted_by)

    def get_reviewed_by(self, obj):
        return self._actor(obj.reviewed_by)


def _latest_revision(article):
    revisions = getattr(article, 'admin_revisions', None)
    if revisions is not None:
        return revisions[0] if revisions else None
    return article.revisions.order_by('-number').first()


class AdminArticleListSerializer(serializers.ModelSerializer):
    category = AdminCategorySerializer(read_only=True)
    title = serializers.SerializerMethodField()
    latest_revision = serializers.SerializerMethodField()
    published_revision_number = serializers.IntegerField(
        source='published_revision.number', read_only=True, allow_null=True
    )

    class Meta:
        model = KnowledgeArticle
        fields = [
            'public_id',
            'category',
            'slug',
            'article_type',
            'title',
            'order',
            'lifecycle_state',
            'latest_revision',
            'published_revision_number',
            'revision_token',
            'review_due_at',
            'first_published_at',
            'current_published_at',
            'created_at',
            'updated_at',
        ]

    def get_title(self, obj):
        revision = _latest_revision(obj)
        return revision.title if revision else ''

    def get_latest_revision(self, obj):
        revision = _latest_revision(obj)
        if not revision:
            return None
        return {
            'number': revision.number,
            'status': revision.status,
            'updated_at': revision.updated_at,
        }


class AuditEventSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    action = serializers.CharField()
    actor_name = serializers.SerializerMethodField()
    payload = serializers.JSONField()
    created_at = serializers.DateTimeField()

    def get_actor_name(self, obj):
        return obj.actor.full_name or obj.actor.email if obj.actor else 'Hệ thống'


class AdminArticleDetailSerializer(AdminArticleListSerializer):
    revisions = serializers.SerializerMethodField()
    audit_events = serializers.SerializerMethodField()

    class Meta(AdminArticleListSerializer.Meta):
        fields = [*AdminArticleListSerializer.Meta.fields, 'revisions', 'audit_events']

    def get_revisions(self, obj):
        revisions = getattr(obj, 'admin_revisions', None)
        if revisions is None:
            revisions = obj.revisions.all()
        return RevisionSerializer(revisions, many=True).data

    def get_audit_events(self, obj):
        events = self.context.get('audit_events', [])
        return AuditEventSerializer(events, many=True).data


class ArticleQuerySerializer(serializers.Serializer):
    category = serializers.SlugField(max_length=160, required=False)
    type = serializers.ChoiceField(
        source='article_type',
        choices=KnowledgeArticle.ArticleType.choices,
        required=False,
    )
    lifecycle = serializers.ChoiceField(
        choices=KnowledgeArticle.LifecycleState.choices,
        required=False,
    )
    revision_status = serializers.ChoiceField(
        choices=KnowledgeArticleRevision.Status.choices,
        required=False,
    )
    review_due = serializers.ChoiceField(choices=['overdue', 'due_soon'], required=False)
    q = serializers.CharField(
        max_length=120, required=False, allow_blank=True, trim_whitespace=True
    )
    ordering = serializers.ChoiceField(
        choices=[field for key in ARTICLE_ORDERING for field in (key, f'-{key}')],
        default='order',
        required=False,
    )
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=60, required=False)


class ArticleCreateSerializer(serializers.Serializer):
    category_public_id = serializers.SlugRelatedField(
        source='category',
        slug_field='public_id',
        queryset=KnowledgeCategory.objects.all(),
    )
    type = serializers.ChoiceField(
        source='article_type', choices=KnowledgeArticle.ArticleType.choices
    )
    title = serializers.CharField(max_length=240)
    body = serializers.CharField()
    source_reference = serializers.CharField(max_length=500)
    order = serializers.IntegerField(min_value=0, default=0)
    seo_title = serializers.CharField(max_length=200, allow_blank=True, required=False)
    seo_description = serializers.CharField(max_length=300, allow_blank=True, required=False)


class ArticleUpdateSerializer(serializers.Serializer):
    category_public_id = serializers.SlugRelatedField(
        source='category',
        slug_field='public_id',
        queryset=KnowledgeCategory.objects.all(),
        required=False,
    )
    slug = serializers.SlugField(max_length=180, required=False)
    type = serializers.ChoiceField(
        source='article_type',
        choices=KnowledgeArticle.ArticleType.choices,
        required=False,
    )
    order = serializers.IntegerField(min_value=0, required=False)
    revision_token = serializers.IntegerField(min_value=1)


class RevisionWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=240, required=False)
    body = serializers.CharField(required=False)
    source_reference = serializers.CharField(max_length=500, required=False)
    change_summary = serializers.CharField(max_length=500, allow_blank=True, required=False)
    seo_title = serializers.CharField(max_length=200, allow_blank=True, required=False)
    seo_description = serializers.CharField(max_length=300, allow_blank=True, required=False)
    revision_token = serializers.IntegerField(min_value=1)


class RevisionActionSerializer(serializers.Serializer):
    revision_token = serializers.IntegerField(min_value=1)
    review_note = serializers.CharField(allow_blank=True, required=False)


class PublishSerializer(serializers.Serializer):
    revision_number = serializers.IntegerField(min_value=1)
    revision_token = serializers.IntegerField(min_value=1)
    review_due_at = serializers.DateTimeField(required=False)


class TokenActionSerializer(serializers.Serializer):
    revision_token = serializers.IntegerField(min_value=1)


class ReorderSerializer(serializers.Serializer):
    public_ids = serializers.ListField(
        child=serializers.CharField(max_length=64),
        allow_empty=False,
    )
    category_public_id = serializers.CharField(max_length=64, required=False)


class MediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeMediaAsset
        fields = [
            'public_id',
            'url',
            'storage_key',
            'original_name',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'default_alt_text',
            'uploaded_by',
            'created_at',
        ]

    def get_url(self, obj):
        return media_url_from_value(obj.storage_key, request=self.context.get('request'))

    def get_uploaded_by(self, obj):
        if not obj.uploaded_by:
            return None
        return {
            'public_id': obj.uploaded_by.public_id,
            'name': obj.uploaded_by.full_name or obj.uploaded_by.email,
        }


class MediaUploadSerializer(serializers.Serializer):
    file = serializers.ImageField()
    default_alt_text = serializers.CharField(max_length=300, allow_blank=True, required=False)
