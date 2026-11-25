from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.db.public_id import generate_public_id

# Mức giữ lâu nhất; admin chỉ rút ngắn được (SiteSetting talent_pool_retention_days,
# áp khi service tạo lượt lưu).
RETENTION_DAYS = 365


def _default_expiry():
    return timezone.now() + timedelta(days=RETENTION_DAYS)


class TalentPoolEntry(models.Model):
    """A candidate a recruiter keeps for future openings.

    The candidate is told when saved and may withdraw at any time; entries
    lapse after 12 months so personal data is not kept indefinitely.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='talent_pool_entries'
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='talent_pool_memberships'
    )
    # The application the candidate was saved from: the job it targeted is
    # what new openings are matched against.
    source_application = models.ForeignKey(
        'applications.Application', on_delete=models.SET_NULL, null=True, related_name='+'
    )
    note = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_expiry)
    removed_at = models.DateTimeField(null=True, blank=True)  # by the recruiter
    withdrawn_at = models.DateTimeField(null=True, blank=True)  # by the candidate

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['recruiter', 'candidate'],
                condition=Q(removed_at__isnull=True, withdrawn_at__isnull=True),
                name='uniq_open_talent_pool_entry',
            ),
        ]
        indexes = [
            models.Index(fields=['recruiter', '-created_at'], name='talent_pool_recruiter_idx')
        ]

    def __str__(self):
        return self.public_id

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tpe')
        super().save(*args, **kwargs)

    @classmethod
    def active_q(cls, prefix=''):
        return Q(
            **{
                f'{prefix}removed_at__isnull': True,
                f'{prefix}withdrawn_at__isnull': True,
                f'{prefix}expires_at__gt': timezone.now(),
            }
        )


class TalentPoolInvitation(models.Model):
    """One invitation to apply, so a candidate is never invited twice to a job."""

    entry = models.ForeignKey(TalentPoolEntry, on_delete=models.CASCADE, related_name='invitations')
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='+')
    invited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['entry', 'job'], name='uniq_talent_pool_invitation'),
        ]

    def __str__(self):
        return f'{self.entry_id} → {self.job_id}'


class CandidateSearchInvitation(models.Model):
    """Lời mời ứng tuyển gửi từ Tìm CV: mỗi ứng viên chỉ được mời một lần cho một tin.

    Tách khỏi `TalentPoolInvitation`: kho ứng viên chỉ chứa người từng ứng tuyển vào tin
    của nhà tuyển dụng, còn Tìm CV mời người chưa từng liên hệ, dựa trên việc họ bật
    "cho phép NTD tìm kiếm".
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='candidate_search_invitations',
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='job_search_invitations'
    )
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='+')
    invited_at = models.DateTimeField(auto_now_add=True)
    # Đồng ý = NTD được kết nối (nhắn tin) với ứng viên; từ chối thì lời mời đóng lại.
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['candidate', 'job'], name='uniq_candidate_search_invitation'
            ),
        ]
        indexes = [
            models.Index(fields=['candidate', '-invited_at'], name='search_invite_candidate_idx')
        ]

    def __str__(self):
        return f'{self.candidate_id} → {self.job_id}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('csi')
        super().save(*args, **kwargs)
