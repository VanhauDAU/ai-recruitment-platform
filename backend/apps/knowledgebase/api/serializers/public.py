from django.utils.text import Truncator
from rest_framework import serializers

from ...models import KnowledgeArticle, KnowledgeCategory


class PublicCategorySerializer(serializers.ModelSerializer):
    article_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = KnowledgeCategory
        fields = ['public_id', 'name', 'slug', 'description', 'order', 'article_count']


class PublicArticleCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeCategory
        fields = ['public_id', 'name', 'slug']


class PublicArticleListSerializer(serializers.ModelSerializer):
    category = PublicArticleCategorySerializer(read_only=True)
    title = serializers.CharField(source='published_revision.title', read_only=True)
    excerpt = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField(source='published_revision.updated_at', read_only=True)

    class Meta:
        model = KnowledgeArticle
        fields = [
            'public_id',
            'category',
            'slug',
            'article_type',
            'title',
            'excerpt',
            'order',
            'updated_at',
        ]

    def get_excerpt(self, obj):
        return Truncator(obj.published_revision.body_plain_text).chars(180)


class PublicArticleCompactSerializer(PublicArticleListSerializer):
    class Meta(PublicArticleListSerializer.Meta):
        fields = [
            'public_id',
            'category',
            'slug',
            'article_type',
            'title',
            'excerpt',
            'order',
            'updated_at',
        ]


class PublicArticleDetailSerializer(PublicArticleListSerializer):
    body = serializers.CharField(source='published_revision.body', read_only=True)
    seo_title = serializers.CharField(source='published_revision.seo_title', read_only=True)
    seo_description = serializers.CharField(
        source='published_revision.seo_description', read_only=True
    )
    published_at = serializers.DateTimeField(source='first_published_at', read_only=True)
    related_articles = serializers.SerializerMethodField()
    previous_article = serializers.SerializerMethodField()
    next_article = serializers.SerializerMethodField()

    class Meta(PublicArticleListSerializer.Meta):
        fields = [
            *PublicArticleListSerializer.Meta.fields,
            'body',
            'seo_title',
            'seo_description',
            'published_at',
            'related_articles',
            'previous_article',
            'next_article',
        ]

    def get_related_articles(self, obj):
        return PublicArticleCompactSerializer(
            self.context.get('related_articles', []), many=True
        ).data

    def get_previous_article(self, obj):
        article = self.context.get('previous_article')
        return PublicArticleCompactSerializer(article).data if article else None

    def get_next_article(self, obj):
        article = self.context.get('next_article')
        return PublicArticleCompactSerializer(article).data if article else None


class PublicArticleQuerySerializer(serializers.Serializer):
    category = serializers.SlugField(max_length=160, required=False)
    type = serializers.ChoiceField(choices=['faq', 'guide'], required=False)
    q = serializers.CharField(
        min_length=2,
        max_length=120,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=60, required=False)

    def validate(self, attrs):
        if article_type := attrs.pop('type', None):
            attrs['article_type'] = article_type.upper()
        if not attrs.get('q'):
            attrs.pop('q', None)
        return attrs
