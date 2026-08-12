from ..models import (
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
