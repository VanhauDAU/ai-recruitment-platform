"""Nội dung mẫu chuẩn (không gắn mẫu trình bày) và các lượt sinh nội dung bằng AI."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.db.public_id import generate_public_id

from .content_schema import empty_layout, empty_style, validate_cv_document
from .experience import ExperienceBand
from .language import CvLanguage
from .position import CvPositionProfile


class CvSampleContent(models.Model):
    """Published canonical starter content; never tied to a renderer/template."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        # Nội dung do AI sinh, chờ admin duyệt (CVT-3).
        IN_REVIEW = 'in_review', 'In review'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class Origin(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        AI = 'ai', 'AI'
        IMPORT = 'import', 'Import'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    # Null = nội dung chung cho mọi vị trí; chuỗi có thể chứa token
    # `{position}`, được thay bằng tên vị trí theo ngôn ngữ khi dựng CV.
    position_profile = models.ForeignKey(
        CvPositionProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sample_contents',
    )
    locale = models.CharField(max_length=16, choices=CvLanguage.choices)
    experience_band = models.CharField(max_length=20, choices=ExperienceBand.choices)
    title = models.CharField(max_length=255)
    content_json = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    origin = models.CharField(max_length=20, choices=Origin.choices, default=Origin.MANUAL)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cv_sample_contents',
    )
    # Admin đã duyệt nội dung (bắt buộc với nội dung AI trước khi xuất bản).
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_cv_sample_contents',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['status', 'locale', 'experience_band'], name='idx_cv_samples_catalog'
            ),
        ]
        # Mỗi tổ hợp chỉ có một nội dung đang xuất bản; bản nháp, bản AI chờ
        # duyệt và bản lưu trữ của cùng tổ hợp cùng tồn tại được (CVT-3).
        constraints = [
            models.UniqueConstraint(
                fields=['position_profile', 'locale', 'experience_band'],
                condition=models.Q(position_profile__isnull=False, status='published'),
                name='uq_cv_sample_published_position',
            ),
            models.UniqueConstraint(
                fields=['locale', 'experience_band'],
                condition=models.Q(position_profile__isnull=True, status='published'),
                name='uq_cv_sample_published_generic',
            ),
        ]
        ordering = ['locale', 'experience_band', 'title']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvsample')
        super().save(*args, **kwargs)

    def clean(self):
        content = self.content_json if isinstance(self.content_json, dict) else {}
        section_ids = [
            section.get('instance_id')
            for section in content.get('sections', [])
            if isinstance(section, dict) and section.get('instance_id')
        ]
        layout = empty_layout()
        layout['regions'][0]['section_instance_ids'] = section_ids
        validate_cv_document(
            content_json=content,
            layout_json=layout,
            style_json=empty_style(),
            schema_version=self.schema_version,
        )
        if content.get('locale') != self.locale:
            raise ValidationError({'locale': 'Must match content_json.locale.'})


class CvSampleGeneration(models.Model):
    """Một lượt sinh nội dung mẫu bằng AI cho (vị trí, ngôn ngữ, nhóm kinh nghiệm).

    Các lượt cùng một yêu cầu của admin chung `batch_id`. Kết quả là một
    `CvSampleContent` ở trạng thái chờ duyệt; lượt lỗi chỉ lưu mã lỗi đã chuẩn
    hóa, không lưu prompt hay phản hồi của provider.
    """

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Đang chờ'
        PROCESSING = 'processing', 'Đang sinh'
        COMPLETED = 'completed', 'Hoàn tất'
        FAILED = 'failed', 'Lỗi'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    batch_id = models.CharField(max_length=50, db_index=True)
    position_profile = models.ForeignKey(
        CvPositionProfile, on_delete=models.CASCADE, related_name='sample_generations'
    )
    locale = models.CharField(max_length=16, choices=CvLanguage.choices)
    experience_band = models.CharField(max_length=20, choices=ExperienceBand.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    failure_code = models.CharField(max_length=64, blank=True)
    sample = models.ForeignKey(
        CvSampleContent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generations',
    )
    invocation = models.ForeignKey(
        'ai_core.AiInvocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cv_sample_generations',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_cv_sample_generations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-pk']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='idx_cv_sample_gen_status'),
        ]

    def __str__(self):
        return f'{self.public_id} ({self.status})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvgen')
        super().save(*args, **kwargs)
