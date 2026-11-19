from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Count
from django.utils import timezone

from common.db.public_id import generate_public_id


class AccountStatusTransition(models.Model):
    """Immutable evidence for one administrator-enforced account transition."""

    class Kind(models.TextChoices):
        SUSPEND = 'suspend', 'Temporarily suspend'
        BAN = 'ban', 'Ban'
        BEGIN_REACTIVATION = 'begin_reactivation', 'Begin reactivation review'
        REACTIVATE = 'reactivate', 'Reactivate'
        RELEASE_RESOURCE_HOLDS = 'release_resource_holds', 'Release resource holds'

    class EffectStatus(models.TextChoices):
        APPLIED = 'applied', 'Applied'
        FAILED = 'failed', 'Failed'

    class ViolationCategory(models.TextChoices):
        SECURITY = 'security', 'Security'
        FRAUD = 'fraud', 'Fraud'
        POLICY = 'policy', 'Policy'
        LEGAL = 'legal', 'Legal'
        OTHER = 'other', 'Other'

    public_id = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='status_transitions',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='account_status_transitions_performed',
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    before_status = models.CharField(max_length=50)
    after_status = models.CharField(max_length=50)
    reason = models.TextField()
    enforcement_evidence = models.TextField(blank=True)
    violation_category = models.CharField(
        max_length=20,
        choices=ViolationCategory.choices,
        blank=True,
    )
    resource_snapshot = models.JSONField(default=dict, blank=True)
    effect_summary = models.JSONField(default=dict, blank=True)
    effect_status = models.CharField(
        max_length=20,
        choices=EffectStatus.choices,
        default=EffectStatus.APPLIED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['user', '-created_at'],
                name='acct_status_user_time_idx',
            ),
            models.Index(
                fields=['kind', '-created_at'],
                name='acct_status_kind_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.kind}:{self.before_status}->{self.after_status}'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('Account status transition records are immutable.')
        if not self.public_id:
            self.public_id = generate_public_id('ast')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Account status transition records cannot be deleted.')


def _group_counts(queryset, *fields):
    return [
        {
            **{field: row[field] for field in fields},
            'count': row['count'],
        }
        for row in queryset.values(*fields).annotate(count=Count('id')).order_by(*fields)
    ]


def account_status_resource_snapshot(user):
    """Return a deterministic, role-aware snapshot bound into impact tokens.

    The preview (selector) and the confirm step (service, under row locks) must
    compute exactly the same snapshot or every impact token would look stale,
    so both layers read it from here.
    """
    # Imported lazily: campaigns/employers models import accounts.models, so a
    # module-level import would be circular during app loading.
    from apps.applications.models import Application
    from apps.campaigns.models import RecruitmentCampaign
    from apps.jobs.models import Job

    from .user import AuthSession, User

    snapshot = {
        'user': {
            'status': user.status,
            'is_active': bool(user.is_active),
            'is_deleted': bool(user.is_deleted),
            'auth_revision': user.auth_revision,
            'updated_at': user.updated_at.isoformat() if user.updated_at else None,
        },
        'active_session_count': AuthSession.objects.filter(
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).count(),
        'role': user.role,
    }
    if user.role == User.Role.EMPLOYER:
        campaigns = RecruitmentCampaign.objects.filter(owner__user=user)
        jobs = Job.objects.filter(posted_by=user)
        company_id = (
            user.recruiter_profile.company_id if hasattr(user, 'recruiter_profile') else None
        )
        snapshot['employer'] = {
            'campaigns': _group_counts(campaigns, 'status', 'policy_hold'),
            'jobs': _group_counts(jobs, 'status', 'policy_hold'),
            'open_application_count': Application.objects.filter(job__posted_by=user)
            .exclude(status__in=[Application.Status.REJECTED, Application.Status.ACCEPTED])
            .count(),
            'affected_candidate_count': Application.objects.filter(job__posted_by=user)
            .values('candidate_id')
            .distinct()
            .count(),
            'company_id': company_id,
            'other_active_recruiter_count': (
                User.objects.filter(
                    recruiter_profile__company_id=company_id,
                    role=User.Role.EMPLOYER,
                    status=User.Status.ACTIVE,
                    is_active=True,
                    is_deleted=False,
                )
                .exclude(pk=user.pk)
                .count()
                if company_id
                else 0
            ),
        }
    elif user.role == User.Role.CANDIDATE:
        applications = Application.objects.filter(candidate=user)
        snapshot['candidate'] = {
            'applications': _group_counts(applications, 'status'),
            'application_count': applications.count(),
            'cv_count': user.cvs.filter(is_deleted=False).count(),
        }
    return snapshot
