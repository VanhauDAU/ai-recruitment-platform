from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.public_id import generate_public_id


class CandidateBlock(models.Model):
    """A company refusing further applications from one candidate.

    The recruiter who blocked is kept for the audit trail, but the block belongs
    to the company at the time it was made: it covers every job of that company
    and stays there when the recruiter leaves. The candidate is never told:
    applying shows a neutral message.
    """

    class Reason(models.TextChoices):
        SPAM = 'spam', 'Ứng tuyển hàng loạt, không phù hợp'
        INAPPROPRIATE = 'inappropriate', 'Hành vi không phù hợp'
        FAKE_PROFILE = 'fake_profile', 'Hồ sơ giả mạo'
        OTHER = 'other', 'Lý do khác'

    # Mass-apply signal: a candidate applying to this many of one recruiter's
    # jobs within the window is suggested for blocking (match score will
    # refine it later).
    MASS_APPLY_WINDOW_DAYS = 14
    MASS_APPLY_MIN_JOBS = 5

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='candidate_blocks'
    )
    company = models.ForeignKey(
        'employers.Company', on_delete=models.PROTECT, related_name='candidate_blocks'
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by_recruiters'
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.TextField(blank=True)
    # The application the recruiter acted from; display context only.
    source_application = models.ForeignKey(
        'applications.Application', on_delete=models.SET_NULL, null=True, related_name='+'
    )
    expires_at = models.DateTimeField(null=True, blank=True)  # NULL: until lifted
    lifted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'candidate'],
                condition=Q(lifted_at__isnull=True),
                name='uniq_active_company_candidate_block',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cbk')
        super().save(*args, **kwargs)

    @classmethod
    def active_q(cls, prefix=''):
        """Blocks in force now; ``prefix`` lets other querysets reuse the rule."""
        now = timezone.now()
        return Q(**{f'{prefix}lifted_at__isnull': True}) & (
            Q(**{f'{prefix}expires_at__isnull': True}) | Q(**{f'{prefix}expires_at__gt': now})
        )
