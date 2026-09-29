from django.db.models import Count, Q, Sum
from django.utils import timezone

from ..models import (
    JobServiceActivation,
    ServiceAuditEvent,
    ServiceCapability,
    ServiceEntitlementUnit,
    ServicePackageVersion,
)

ENTITLEMENT_ORDERING_FIELDS = {
    'activate_by': 'activate_by',
    'created_at': 'created_at',
    'granted_at': 'granted_at',
    'package_name': 'package_version__package__name_vi',
    'source': 'source',
    'status': 'status',
}

SERVICE_AUDIT_ORDERING_FIELDS = {
    'actor': 'actor__email',
    'company': 'company__company_name',
    'event_type': 'event_type',
    'occurred_at': 'occurred_at',
    'package_name': 'package_version__package__name_vi',
}

ACTIVATION_ORDERING_FIELDS = {
    'company_name': 'company__company_name',
    'created_at': 'created_at',
    'ends_at': 'ends_at',
    'job_title': 'job__title',
    'package_name': 'unit__package_version__package__name_vi',
    'starts_at': 'starts_at',
    'status': 'status',
}


def _stable_order(queryset, ordering, fields, default):
    ordering = ordering or default
    descending = ordering.startswith('-')
    key = ordering.removeprefix('-')
    field = fields.get(key, fields[default.removeprefix('-')])
    prefix = '-' if descending else ''
    return queryset.order_by(f'{prefix}{field}', '-id' if descending else 'id')


def admin_capabilities_queryset():
    return ServiceCapability.objects.order_by('code')


def admin_package_versions_queryset(*, package_id=None, status=None):
    queryset = ServicePackageVersion.objects.select_related('package').prefetch_related(
        'items__capability'
    )
    if package_id:
        queryset = queryset.filter(package_id=package_id)
    if status:
        queryset = queryset.filter(status=status)
    return queryset.order_by('package_id', '-version_number')


def admin_entitlement_units_queryset(*, company_public_id='', status='', ordering='-created_at'):
    queryset = ServiceEntitlementUnit.objects.select_related(
        'company',
        'package_version__package',
        'created_by',
        'activation',
    )
    if company_public_id:
        queryset = queryset.filter(company__public_id=company_public_id)
    if status:
        queryset = queryset.filter(status=status)
    return _stable_order(
        queryset,
        ordering,
        ENTITLEMENT_ORDERING_FIELDS,
        '-created_at',
    )


def admin_service_audit_queryset(*, company_public_id='', event_type='', ordering='-occurred_at'):
    queryset = ServiceAuditEvent.objects.select_related(
        'actor',
        'company',
        'package_version__package',
        'unit',
        'activation',
    )
    if company_public_id:
        queryset = queryset.filter(company__public_id=company_public_id)
    if event_type:
        queryset = queryset.filter(event_type=event_type)
    return _stable_order(
        queryset,
        ordering,
        SERVICE_AUDIT_ORDERING_FIELDS,
        '-occurred_at',
    )


def _activation_queryset():
    return JobServiceActivation.objects.select_related(
        'company',
        'job__campaign',
        'unit__package_version__package',
    ).prefetch_related('items__capability')


def _filter_activation_scope(
    queryset,
    *,
    company_public_id='',
    status='',
    job_public_id='',
    campaign_public_id='',
):
    if company_public_id:
        queryset = queryset.filter(company__public_id=company_public_id)
    if status:
        queryset = queryset.filter(status=status)
    if job_public_id:
        queryset = queryset.filter(job__public_id=job_public_id)
    if campaign_public_id:
        queryset = queryset.filter(job__campaign__public_id=campaign_public_id)
    return queryset


def _with_activation_metrics(queryset):
    return queryset.annotate(
        promotion_metric_days=Count('promotion_metrics', distinct=True),
        promotion_impressions=Sum('promotion_metrics__impression_count', default=0),
        promotion_views=Sum('promotion_metrics__view_count', default=0),
        promotion_saves=Sum('promotion_metrics__save_count', default=0),
        promotion_applies=Sum('promotion_metrics__apply_count', default=0),
    )


def employer_active_job_service_activations(
    *,
    company,
    owner,
    job_public_id='',
    campaign_public_id='',
    at=None,
):
    at = at or timezone.now()
    queryset = _activation_queryset().filter(
        company=company,
        job__posted_by=owner,
        status=JobServiceActivation.Status.ACTIVE,
        starts_at__lte=at,
        ends_at__gt=at,
    )
    queryset = _filter_activation_scope(
        queryset,
        job_public_id=job_public_id,
        campaign_public_id=campaign_public_id,
    )
    return _with_activation_metrics(queryset).order_by('ends_at', 'id')


def employer_job_service_activation_history(
    *,
    company,
    owner,
    status='',
    job_public_id='',
    campaign_public_id='',
    ordering='-created_at',
):
    queryset = _filter_activation_scope(
        _activation_queryset().filter(company=company, job__posted_by=owner),
        status=status,
        job_public_id=job_public_id,
        campaign_public_id=campaign_public_id,
    )
    return _stable_order(
        _with_activation_metrics(queryset),
        ordering,
        ACTIVATION_ORDERING_FIELDS,
        '-created_at',
    )


def admin_job_service_activations_queryset(
    *,
    company_public_id='',
    status='',
    job_public_id='',
    campaign_public_id='',
    ordering='-created_at',
):
    queryset = _filter_activation_scope(
        _activation_queryset(),
        company_public_id=company_public_id,
        status=status,
        job_public_id=job_public_id,
        campaign_public_id=campaign_public_id,
    )
    return _stable_order(
        _with_activation_metrics(queryset),
        ordering,
        ACTIVATION_ORDERING_FIELDS,
        '-created_at',
    )


def admin_job_service_activation_summary(
    *,
    company_public_id='',
    job_public_id='',
    campaign_public_id='',
    at=None,
):
    at = at or timezone.now()
    activations = _filter_activation_scope(
        JobServiceActivation.objects.all(),
        company_public_id=company_public_id,
        job_public_id=job_public_id,
        campaign_public_id=campaign_public_id,
    )
    activation_summary = activations.aggregate(
        total=Count('id', distinct=True),
        active=Count(
            'id',
            filter=Q(status=JobServiceActivation.Status.ACTIVE),
            distinct=True,
        ),
        expired=Count(
            'id',
            filter=Q(status=JobServiceActivation.Status.EXPIRED),
            distinct=True,
        ),
        terminated=Count(
            'id',
            filter=Q(status=JobServiceActivation.Status.TERMINATED),
            distinct=True,
        ),
        active_total=Count(
            'id',
            filter=Q(
                status=JobServiceActivation.Status.ACTIVE,
                starts_at__lte=at,
                ends_at__gt=at,
            ),
            distinct=True,
        ),
        impressions=Sum('promotion_metrics__impression_count', default=0),
        views=Sum('promotion_metrics__view_count', default=0),
        saves=Sum('promotion_metrics__save_count', default=0),
        applies=Sum('promotion_metrics__apply_count', default=0),
        metric_days=Count('promotion_metrics', distinct=True),
    )

    units = ServiceEntitlementUnit.objects.all()
    if company_public_id:
        units = units.filter(company__public_id=company_public_id)
    if job_public_id:
        units = units.filter(activation__job__public_id=job_public_id)
    if campaign_public_id:
        units = units.filter(activation__job__campaign__public_id=campaign_public_id)
    unit_summary = units.aggregate(
        available=Count('id', filter=Q(status=ServiceEntitlementUnit.Status.AVAILABLE)),
        consumed=Count('id', filter=Q(status=ServiceEntitlementUnit.Status.CONSUMED)),
        expired=Count('id', filter=Q(status=ServiceEntitlementUnit.Status.EXPIRED)),
        revoked=Count('id', filter=Q(status=ServiceEntitlementUnit.Status.REVOKED)),
    )
    return {
        'activation_counts': {
            key: activation_summary[key] for key in ('total', 'active', 'expired', 'terminated')
        },
        'active_total': activation_summary['active_total'],
        'metrics': {
            'available': bool(activation_summary['metric_days']),
            **{
                key: activation_summary[key] for key in ('impressions', 'views', 'saves', 'applies')
            },
        },
        'unit_counts': unit_summary,
    }
