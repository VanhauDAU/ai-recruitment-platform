from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy

from ..domain import normalize_skill_name


def unique_slug(model, name, *, exclude_pk=None):
    """Slug từ tên, thêm hậu tố khi trùng: "C", "C++", "C#" đều cho ra "c"."""
    base = slugify(name)[:240] or 'muc'
    taken = set(
        model.objects.filter(slug__startswith=base)
        .exclude(pk=exclude_pk)
        .values_list('slug', flat=True)
    )
    slug, suffix = base, 2
    while slug in taken:
        slug, suffix = f'{base}-{suffix}', suffix + 1
    return slug


class SkillGroup(models.Model):
    """Open taxonomy for grouping skills across every profession."""

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(SkillGroup, self.name, exclude_pk=self.pk)
        super().save(*args, **kwargs)


class Skill(models.Model):
    """Single source of truth for skills across the whole system (DB doc section 2.8).

    Every place that stores "skills" (candidate profile via CV, CV content,
    job requirements, AI analysis results) references skill_id here instead
    of free-text strings, so CV-Job matching and skill-group classification
    stay consistent.
    """

    class Source(models.TextChoices):
        SEED = 'seed', gettext_lazy('Hệ thống')
        IMPORT = 'import', gettext_lazy('Nhập dữ liệu')
        EMPLOYER = 'employer', gettext_lazy('Nhà tuyển dụng')
        ADMIN = 'admin', gettext_lazy('Quản trị viên')

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    normalized_name = models.CharField(max_length=255, unique=True, editable=False)
    aliases = models.JSONField(
        default=list,
        blank=True,
        help_text='Alternate names for keyword matching, e.g. ["ReactJS", "React.js"]',
    )
    group = models.ForeignKey(
        SkillGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='skills',
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    # Ai đưa kỹ năng vào danh mục, để admin rà các kỹ năng nhà tuyển dụng tự thêm.
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SEED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['group__name', 'name']

    def __str__(self):
        return f'{self.name} ({self.group.name})' if self.group else self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(Skill, self.name, exclude_pk=self.pk)
        self.normalized_name = normalize_skill_name(self.name)
        super().save(*args, **kwargs)
