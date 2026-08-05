from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from common.public_id import generate_public_id


class KnowledgeCategory(models.Model):
    public_id = models.CharField(max_length=64, unique=True, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=160, unique=True)
    description = models.CharField(max_length=300, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    review_interval_days = models.PositiveSmallIntegerField(
        default=180,
        validators=[MinValueValidator(30), MaxValueValidator(365)],
    )
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    revision_token = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name', 'public_id']
        constraints = [
            models.CheckConstraint(condition=Q(order__gte=0), name='chk_kb_cat_order'),
            models.CheckConstraint(
                condition=Q(review_interval_days__range=(30, 365)),
                name='chk_kb_cat_review_days',
            ),
            models.CheckConstraint(
                condition=Q(revision_token__gte=1), name='chk_kb_cat_revision_token'
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('kbc')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class KnowledgeArticle(models.Model):
    class ArticleType(models.TextChoices):
        FAQ = 'FAQ', 'Câu hỏi thường gặp'
        GUIDE = 'GUIDE', 'Hướng dẫn'

    class LifecycleState(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Đang hoạt động'
        ARCHIVED = 'ARCHIVED', 'Đã lưu trữ'

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    category = models.ForeignKey(
        KnowledgeCategory,
        related_name='articles',
        on_delete=models.PROTECT,
    )
    slug = models.SlugField(max_length=180)
    article_type = models.CharField(
        max_length=10,
        choices=ArticleType.choices,
        default=ArticleType.FAQ,
    )
    order = models.PositiveIntegerField(default=0)
    lifecycle_state = models.CharField(
        max_length=12,
        choices=LifecycleState.choices,
        default=LifecycleState.ACTIVE,
    )
    published_revision = models.ForeignKey(
        'KnowledgeArticleRevision',
        related_name='+',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    revision_token = models.PositiveIntegerField(default=1)
    review_due_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_articles_created',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_articles_archived',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    first_published_at = models.DateTimeField(null=True, blank=True)
    current_published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['category__order', 'order', 'public_id']
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'slug'], name='uq_kb_article_category_slug'
            ),
            models.CheckConstraint(condition=Q(order__gte=0), name='chk_kb_article_order'),
            models.CheckConstraint(
                condition=Q(revision_token__gte=1), name='chk_kb_article_revision_token'
            ),
        ]
        indexes = [
            models.Index(
                fields=['category', 'lifecycle_state', 'order'],
                name='kb_article_public_idx',
            ),
            models.Index(fields=['review_due_at'], name='kb_article_review_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('kba')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.category.slug}/{self.slug}'


class KnowledgeArticleRevision(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Nháp'
        IN_REVIEW = 'IN_REVIEW', 'Chờ duyệt'
        APPROVED = 'APPROVED', 'Đã duyệt'
        REJECTED = 'REJECTED', 'Bị từ chối'

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    article = models.ForeignKey(
        KnowledgeArticle,
        related_name='revisions',
        on_delete=models.CASCADE,
    )
    number = models.PositiveIntegerField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    title = models.CharField(max_length=240)
    body = models.TextField()
    body_plain_text = models.TextField(editable=False)
    content_hash = models.CharField(max_length=64, editable=False)
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    change_summary = models.CharField(max_length=500, blank=True)
    source_reference = models.CharField(max_length=500)
    review_note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_revisions_created',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_revisions_submitted',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_revisions_reviewed',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    first_published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_revisions_first_published',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    first_published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['article_id', '-number']
        constraints = [
            models.UniqueConstraint(
                fields=['article', 'number'], name='uq_kb_revision_article_number'
            ),
            models.UniqueConstraint(
                fields=['article'],
                condition=Q(status__in=['DRAFT', 'IN_REVIEW']),
                name='uq_kb_revision_open_article',
            ),
            models.CheckConstraint(condition=Q(number__gte=1), name='chk_kb_revision_number'),
        ]
        indexes = [
            models.Index(fields=['article', '-number'], name='kb_revision_number_idx'),
            models.Index(fields=['status', '-updated_at'], name='kb_revision_status_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('kbr')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.article.public_id}:r{self.number}'


class KnowledgeMediaAsset(models.Model):
    public_id = models.CharField(max_length=64, unique=True, editable=False)
    storage_key = models.TextField(unique=True)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.PositiveBigIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    default_alt_text = models.CharField(max_length=300, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='knowledge_media_uploaded',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['-created_at'], name='kb_media_created_idx')]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('kbm')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.original_name
