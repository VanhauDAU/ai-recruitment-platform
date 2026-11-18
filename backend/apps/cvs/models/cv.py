"""The candidate's CV aggregate root and the skills declared on it."""

from django.conf import settings
from django.db import models

from apps.cv_templates.models import CvLanguage
from apps.skills.models import Skill
from common.db.public_id import generate_public_id


class UserCv(models.Model):
    """A candidate's CV — either built with the CV Builder or uploaded (DB doc section 2.5)."""

    class CvType(models.TextChoices):
        BUILDER = 'builder', 'Builder'
        UPLOADED = 'uploaded', 'Uploaded'

    class Source(models.TextChoices):
        BUILDER = 'builder', 'Builder'
        UPLOADED = 'uploaded', 'Uploaded'
        IMPORTED = 'imported', 'Imported'

    class LifecycleStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    class ProcessingStatus(models.TextChoices):
        IDLE = 'idle', 'Idle'
        QUEUED = 'queued', 'Queued'
        PROCESSING = 'processing', 'Processing'
        ANALYZED = 'analyzed', 'Analyzed'
        FAILED = 'failed', 'Failed'

    class Visibility(models.TextChoices):
        PRIVATE = 'private', 'Private'
        APPLICATION_ONLY = 'application_only', 'Application only'
        SHARED_LINK = 'shared_link', 'Shared link'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cvs')
    template = models.ForeignKey(
        'cv_templates.CvTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cvs',
    )
    position = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='candidate_cvs',
    )
    cv_type = models.CharField(max_length=50, choices=CvType.choices)
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.BUILDER)
    title = models.CharField(max_length=255)
    file_url = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=50, blank=True, help_text='pdf, docx')
    error_message = models.TextField(blank=True)
    # Trường matching (CVT-1c): giá trị `Job.ExperienceYears`, tính từ mục kinh
    # nghiệm mỗi khi tạo version (services/matching_profile.py). Không đặt
    # `choices` ở đây để tránh import vòng cvs ↔ jobs; service bảo đảm giá trị.
    experience_years = models.CharField(max_length=20, blank=True)
    # CVT-3, cùng quy ước: `Job.PositionLevel` do ứng viên chọn trong editor;
    # `Job.EducationLevel` là bậc học cao nhất trong mục học vấn, tính khi tạo version.
    position_level = models.CharField(max_length=20, blank=True)
    education_level = models.CharField(max_length=20, blank=True)
    # Khóa CV vi phạm (CVT-4): admin thu hồi và chặn chia sẻ công khai; ứng viên
    # vẫn sửa, xuất PDF và dùng CV để ứng tuyển.
    moderation_locked_at = models.DateTimeField(null=True, blank=True)
    moderation_lock_reason = models.CharField(max_length=255, blank=True)
    moderation_locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='locked_cvs',
    )
    language = models.CharField(max_length=16, choices=CvLanguage.choices, default=CvLanguage.VI)
    lifecycle_status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.DRAFT,
    )
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.IDLE,
    )
    visibility = models.CharField(
        max_length=30,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
    )
    # Ứng viên chọn CV nào cho NTD tìm thấy. Chỉ bật được khi hồ sơ đã đồng ý
    # RECRUITER_VISIBILITY; tìm kiếm phía NTD phải kiểm tra cả hai điều kiện.
    recruiter_searchable = models.BooleanField(default=False)
    current_template_version = models.ForeignKey(
        'cv_templates.CvTemplateVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_cvs',
    )
    latest_version = models.ForeignKey(
        'CvVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    published_version = models.ForeignKey(
        'CvVersion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    lock_version = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    last_exported_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_default']),
            models.Index(
                fields=['user', 'lifecycle_status', '-updated_at'], name='idx_user_cvs_lifecycle'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_default=True, is_deleted=False),
                name='uq_user_active_default_cv',
            ),
        ]

    def __str__(self):
        return f'{self.title} ({self.user.email})'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cv')
        super().save(*args, **kwargs)


class CvSkill(models.Model):
    """Skills detected/declared in a specific CV (DB doc section 2.9)."""

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        AI_EXTRACTED = 'ai_extracted', 'AI extracted'

    class Level(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    cv = models.ForeignKey(UserCv, on_delete=models.CASCADE, related_name='cv_skills')
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='cv_skills')
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.MANUAL)
    level = models.CharField(max_length=50, choices=Level.choices, blank=True)
    years_experience = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    evidence_text = models.TextField(blank=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cv', 'skill'], name='uq_cv_skills_cv_skill'),
        ]

    def __str__(self):
        return f'{self.cv_id} - {self.skill.name}'
