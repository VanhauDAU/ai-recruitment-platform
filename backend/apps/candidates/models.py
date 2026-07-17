from django.conf import settings
from django.db import models
from django.utils import timezone


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
    # Cờ nghiệp vụ duy nhất cho onboarding: form nhu cầu việc làm đã được lưu
    # hợp lệ. Không lưu state machine hay timestamp onboarding.
    job_preferences_configured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'CandidateProfile<{self.user.email}>'


class CandidateJobPreference(models.Model):
    """Nhu cầu tìm việc hiện hành của ứng viên.

    Tách khỏi các text field legacy trên CandidateProfile để selection có thể
    ràng buộc, dùng lại cho gợi ý việc làm và không bị lệch dữ liệu.
    """

    class ExperienceLevel(models.TextChoices):
        NO_EXPERIENCE = 'no_experience', 'Chưa có kinh nghiệm'
        UNDER_1 = 'under_1', 'Dưới 1 năm'
        ONE = '1', '1 năm'
        TWO = '2', '2 năm'
        THREE = '3', '3 năm'
        FOUR = '4', '4 năm'
        FIVE = '5', '5 năm'
        OVER_5 = 'over_5', 'Trên 5 năm'

    candidate_profile = models.OneToOneField(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='job_preference',
    )
    desired_position_other = models.CharField(max_length=255, null=True, blank=True)
    desired_salary_vnd = models.PositiveBigIntegerField(null=True, blank=True)
    experience_level = models.CharField(max_length=20, choices=ExperienceLevel.choices, blank=True)
    # Null biểu thị người dùng chưa trả lời; False là đã trả lời không sẵn sàng.
    willing_to_relocate = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_job_preferences'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(desired_salary_vnd__isnull=True) | models.Q(desired_salary_vnd__gt=0),
                name='candidate_pref_salary_positive',
            ),
        ]

    def __str__(self):
        return f'CandidateJobPreference<{self.candidate_profile.user_id}>'


class CandidateDesiredSpecialization(models.Model):
    """Một vị trí chuyên môn trong danh sách tối đa năm vị trí mong muốn."""

    job_preference = models.ForeignKey(
        CandidateJobPreference,
        on_delete=models.CASCADE,
        related_name='desired_specializations',
    )
    job_category = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.PROTECT,
        related_name='interested_candidates',
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'candidate_desired_specializations'
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['job_preference', 'job_category'],
                name='candidate_pref_specialization_unique',
            ),
        ]


class CandidatePreferredProvince(models.Model):
    """Tỉnh/thành ứng viên mong muốn làm việc (không nhận phường/xã)."""

    job_preference = models.ForeignKey(
        CandidateJobPreference,
        on_delete=models.CASCADE,
        related_name='preferred_provinces',
    )
    location = models.ForeignKey(
        'locations.Location',
        on_delete=models.PROTECT,
        related_name='candidate_preferred_by',
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'candidate_preferred_provinces'
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['job_preference', 'location'],
                name='candidate_pref_province_unique',
            ),
        ]


class CandidateConsent(models.Model):
    """Quyết định consent hiện hành theo từng mục đích xử lý dữ liệu."""

    class ConsentType(models.TextChoices):
        AI_RECOMMENDATION = 'ai_recommendation', 'Gợi ý việc làm bằng AI'
        RECRUITER_VISIBILITY = 'recruiter_visibility', 'Hiển thị với nhà tuyển dụng'

    class Decision(models.TextChoices):
        GRANTED = 'granted', 'Đồng ý'
        DENIED = 'denied', 'Không đồng ý'

    candidate_profile = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='consents',
    )
    consent_type = models.CharField(max_length=30, choices=ConsentType.choices)
    decision = models.CharField(max_length=20, choices=Decision.choices)
    policy_version = models.CharField(max_length=64, default='v1')
    decided_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'candidate_consents'
        constraints = [
            models.UniqueConstraint(
                fields=['candidate_profile', 'consent_type'],
                name='candidate_consent_type_unique',
            ),
        ]


class CandidateConsentEvent(models.Model):
    """Immutable audit trail for a candidate privacy decision."""

    candidate_profile = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name='consent_events',
    )
    consent_type = models.CharField(max_length=30, choices=CandidateConsent.ConsentType.choices)
    decision = models.CharField(max_length=20, choices=CandidateConsent.Decision.choices)
    policy_version = models.CharField(max_length=64, default='v1')
    source = models.CharField(max_length=64)
    source_path = models.TextField(blank=True)
    cv_public_id = models.CharField(max_length=50, blank=True)
    decided_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'candidate_consent_events'
        ordering = ['-decided_at', '-id']
        indexes = [
            models.Index(
                fields=['candidate_profile', 'consent_type', '-decided_at'],
                name='candidate_consent_event_lookup',
            ),
        ]
