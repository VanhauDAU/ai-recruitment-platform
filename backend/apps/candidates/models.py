from django.conf import settings
from django.db import models


class CandidateProfile(models.Model):
    """Candidate details and job-search preferences (DB doc section 2.2.

    Skills are intentionally NOT stored here — they live on the candidate's
    default CV via cv_skills, so there is one single source of skill data
    instead of two that can drift apart.
    """

    class WorkType(models.TextChoices):
        REMOTE = 'remote', 'Remote'
        ONSITE = 'onsite', 'Onsite'
        HYBRID = 'hybrid', 'Hybrid'

    class JobSearchStatus(models.TextChoices):
        OPEN_TO_WORK = 'open_to_work', 'Open to work'
        NOT_LOOKING = 'not_looking', 'Not looking'
        CASUALLY_LOOKING = 'casually_looking', 'Casually looking'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='candidate_profile')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    current_position = models.CharField(max_length=255, blank=True)
    desired_position = models.CharField(max_length=255, blank=True)
    experience_years = models.DecimalField(max_digits=4, decimal_places=1, default=0)
    education_level = models.CharField(max_length=255, blank=True)
    expected_salary_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    expected_salary_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    preferred_location = models.CharField(max_length=255, blank=True)
    preferred_work_type = models.CharField(max_length=50, choices=WorkType.choices, blank=True)
    job_search_status = models.CharField(max_length=50, choices=JobSearchStatus.choices, blank=True)
    portfolio_url = models.TextField(blank=True)
    github_url = models.TextField(blank=True)
    linkedin_url = models.TextField(blank=True)
    headline = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    career_objective = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'CandidateProfile<{self.user.email}>'
