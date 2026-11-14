"""Who may edit a company page (ADR-0017, decision 4).

Editing rights are a policy derived at request time, never a stored role: a
lapsed verification, a compliance hold or a revoked grant takes effect on the
next request without a background job. The module sits at the models layer so
selectors and services, which may not import each other, share one decision.
"""

from dataclasses import dataclass

from django.db.models import Exists, OuterRef, Q

from .company_page import CompanyPageEditorGrant
from .compliance import EmployerComplianceHold
from .membership import RecruiterProfile
from .readiness import has_explicit_company_link
from .representation import eligible_representatives_queryset

BLOCKER_MESSAGES = {
    'OWNER_NOT_VERIFIED': (
        'Người tạo hồ sơ công ty chưa có xác thực nhà tuyển dụng còn hiệu lực '
        'nên trang công ty chưa thể tuỳ biến.'
    ),
    'NOT_VERIFIED': 'Bạn cần hoàn tất xác thực nhà tuyển dụng để tuỳ biến trang công ty.',
    'COMPLIANCE_HOLD': 'Tài khoản của bạn đang bị hạn chế tuân thủ nên chưa thể tuỳ biến trang công ty.',
    'NO_GRANT': 'Bạn chưa được người tạo hồ sơ công ty cấp quyền biên tập trang công ty.',
}


@dataclass(frozen=True)
class CompanyPageAccess:
    can_view: bool = False
    can_edit_layout: bool = False
    can_edit_content: bool = False
    can_manage_editors: bool = False
    # ``{'code', 'message'}`` for every reason editing is closed, else empty.
    blockers: tuple = ()


def page_access_recruiters(company_id):
    """Recruiters of one company annotated with every input of the policy."""
    representatives = eligible_representatives_queryset().filter(pk=OuterRef('pk'))
    active_holds = EmployerComplianceHold.objects.filter(
        recruiter_id=OuterRef('pk'),
        status=EmployerComplianceHold.Status.ACTIVE,
    )
    active_grants = CompanyPageEditorGrant.objects.filter(
        recruiter_id=OuterRef('pk'),
        company_id=OuterRef('company_id'),
        revoked_at__isnull=True,
    )
    return RecruiterProfile.objects.filter(company_id=company_id).annotate(
        is_representative=Exists(representatives),
        has_compliance_hold=Exists(active_holds),
        has_page_grant=Exists(active_grants),
    )


def is_page_eligible(recruiter):
    """``recruiter`` must come from ``page_access_recruiters``."""
    return recruiter.is_representative and not recruiter.has_compliance_hold


def is_company_owner(recruiter):
    return recruiter.company_role == RecruiterProfile.CompanyRole.OWNER


def resolve_company_page_access(recruiter):
    """Evaluate the page policy for ``recruiter`` with one query."""
    if recruiter is None or not has_explicit_company_link(recruiter):
        return CompanyPageAccess()

    rows = list(
        page_access_recruiters(recruiter.company_id).filter(
            Q(pk=recruiter.pk) | Q(company_role=RecruiterProfile.CompanyRole.OWNER)
        )
    )
    me = next(row for row in rows if row.pk == recruiter.pk)
    eligible = is_page_eligible(me)
    owner_eligible = any(is_page_eligible(row) for row in rows if is_company_owner(row))
    can_manage_editors = is_company_owner(me) and eligible
    can_edit = can_manage_editors or (eligible and me.has_page_grant and owner_eligible)

    reasons = {
        'OWNER_NOT_VERIFIED': not owner_eligible,
        'NOT_VERIFIED': not me.is_representative,
        'COMPLIANCE_HOLD': me.has_compliance_hold,
        'NO_GRANT': eligible and not is_company_owner(me) and not me.has_page_grant,
    }
    return CompanyPageAccess(
        can_view=True,
        can_edit_layout=can_edit,
        can_edit_content=can_edit,
        can_manage_editors=can_manage_editors,
        blockers=tuple(
            {'code': code, 'message': BLOCKER_MESSAGES[code]}
            for code, applies in reasons.items()
            if applies
        ),
    )
