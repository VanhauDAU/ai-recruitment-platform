from django.db import models

from .core import Job


class JobSkill(models.Model):
    """Skills required by a job posting (DB doc section 2.13)."""

    class Importance(models.TextChoices):
        REQUIRED = 'required', 'Required'
        PREFERRED = 'preferred', 'Preferred'

    class MinLevel(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='job_skills')
    skill = models.ForeignKey('skills.Skill', on_delete=models.CASCADE, related_name='job_skills')
    importance = models.CharField(max_length=50, choices=Importance.choices, default=Importance.REQUIRED)
    weight = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)
    min_level = models.CharField(max_length=50, choices=MinLevel.choices, blank=True)
    min_years_experience = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['job', 'skill'], name='uq_job_skills_job_skill'),
        ]

    def __str__(self):
        return f'{self.job_id} - {self.skill.name}'
