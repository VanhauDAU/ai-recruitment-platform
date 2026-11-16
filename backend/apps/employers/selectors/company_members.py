"""The company manager's view of its members, with a fixed number of queries."""

from django.db.models import (
    Case,
    Count,
    Exists,
    IntegerField,
    OuterRef,
    Prefetch,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce

from apps.applications.models import Application
from apps.jobs.models import Job

from ..models import (
    CompanyJoinRequest,
    CompanyPageEditorGrant,
    EmployerComplianceHold,
    RecruiterProfile,
    RecruitmentCampaign,
)
from ..models.representation import eligible_representatives_queryset

CLOSED_CAMPAIGN_STATUSES = (
    RecruitmentCampaign.Status.COMPLETED,
    RecruitmentCampaign.Status.CANCELLED,
)


def _count(queryset):
    """Correlated COUNT of ``queryset`` as an integer annotation (0 when empty)."""
    counted = (
        queryset.order_by()
        .annotate(group=Value(1))
        .values('group')
        .annotate(total=Count('pk'))
        .values('total')[:1]
    )
    return Coalesce(Subquery(counted, output_field=IntegerField()), 0)


def company_members_queryset(company):
    """Every recruiter of ``company``, manager first, with what the manager acts on."""
    approved_join = CompanyJoinRequest.objects.filter(
        recruiter_id=OuterRef('pk'),
        company_id=company.pk,
        status=CompanyJoinRequest.Status.APPROVED,
    ).order_by('-decided_at')
    own_jobs = Job.objects.filter(posted_by_id=OuterRef('user_id'), company_id=company.pk)
    return (
        RecruiterProfile.objects.filter(company=company)
        .select_related('user', 'verification_case')
        .prefetch_related(
            Prefetch(
                'page_editor_grants',
                queryset=CompanyPageEditorGrant.objects.filter(
                    company=company, revoked_at__isnull=True
                ),
                to_attr='active_page_grants',
            )
        )
        .annotate(
            is_verified_representative=Exists(
                eligible_representatives_queryset().filter(pk=OuterRef('pk'))
            ),
            has_compliance_hold=Exists(
                EmployerComplianceHold.objects.filter(
                    recruiter_id=OuterRef('pk'), status=EmployerComplianceHold.Status.ACTIVE
                )
            ),
            joined_at=Subquery(approved_join.values('decided_at')[:1]),
            approved_by_name=Subquery(approved_join.values('decided_by__full_name')[:1]),
            active_job_count=_count(own_jobs.filter(status=Job.Status.ACTIVE)),
            unanswered_application_count=_count(
                Application.objects.filter(
                    job__posted_by_id=OuterRef('user_id'),
                    job__company_id=company.pk,
                    is_current=True,
                    status__in=Application.UNANSWERED_STATUSES,
                )
            ),
            open_campaign_count=_count(
                RecruitmentCampaign.objects.filter(owner_id=OuterRef('pk')).exclude(
                    status__in=CLOSED_CAMPAIGN_STATUSES
                )
            ),
        )
        .annotate(
            manager_first=Case(
                When(company_role=RecruiterProfile.CompanyRole.OWNER, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        )
        .order_by('manager_first', 'created_at', 'pk')
    )
