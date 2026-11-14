"""Write-side commands for the public company page."""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action

from ..models import Company, CompanyPageEvent


@transaction.atomic
def set_company_page_policy_hold(company, *, actor, hold, reason):
    """Hide or restore a public company page and leave both audit trails."""
    # QuerySet.update() on purpose: Company.save() would move updated_at, the
    # optimistic-lock base of open company update requests. The state filter
    # lets only one of two concurrent identical decisions write audit rows.
    changed = Company.objects.filter(pk=company.pk, content_policy_hold=not hold).update(
        content_policy_hold=hold
    )
    if not changed:
        raise ValidationError(
            {
                'detail': (
                    'Trang công ty đang bị tạm ẩn.'
                    if hold
                    else 'Trang công ty hiện không bị tạm ẩn.'
                )
            }
        )
    CompanyPageEvent.objects.create(
        company=company,
        actor=actor,
        event_type=(
            CompanyPageEvent.EventType.POLICY_HOLD_APPLIED
            if hold
            else CompanyPageEvent.EventType.POLICY_HOLD_RELEASED
        ),
        payload={'reason': reason},
    )
    record_admin_action(
        actor=actor,
        action='apply_company_page_hold' if hold else 'release_company_page_hold',
        target_type='company',
        target_public_id=company.public_id,
        payload={'reason': reason},
    )
