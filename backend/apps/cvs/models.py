from django.conf import settings
from django.db import models

from common.public_id import generate_public_id
from apps.skills.models import Skill


class UserCv(models.Model):
    """A candidate's CV — either built with the CV Builder or uploaded (DB doc section 2.5)."""

    class CvType(models.TextChoices):
        BUILDER = 'builder', 'Builder'
        UPLOADED = 'uploaded', 'Uploaded'

    class Source(models.TextChoices):
        BUILDER = 'builder', 'Builder'
        UPLOADED = 'uploaded', 'Uploaded'
        IMPORTED = 'imported', 'Imported'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        UPLOADED = 'uploaded', 'Uploaded'
        PROCESSING = 'processing', 'Processing'
        ANALYZED = 'analyzed', 'Analyzed'
        FAILED = 'failed', 'Failed'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cvs')
    template = models.ForeignKey('cv_templates.CvTemplate', on_delete=models.SET_NULL, null=True, blank=True, related_name='cvs')
    cv_type = models.CharField(max_length=50, choices=CvType.choices)
    source = models.CharField(max_length=50, choices=Source.choices, default=Source.BUILDER)
    title = models.CharField(max_length=255)
    cv_data = models.JSONField(default=dict, blank=True)
    style_config = models.JSONField(default=dict, blank=True)
    file_url = models.TextField(blank=True)
    pdf_url = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=50, blank=True, help_text='pdf, docx')
    raw_text = models.TextField(blank=True)
    normalized_text = models.TextField(blank=True)
    current_version = models.IntegerField(default=1)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.DRAFT)
    error_message = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    last_analyzed_at = models.DateTimeField(null=True, blank=True)
    last_exported_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_default']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'uploaded', 'processing', 'analyzed', 'failed']),
                name='chk_user_cvs_status',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cv')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.title} ({self.user.email})'


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
