"""Request-level checks on the caller's place in a company.

Each returns what the view needs next and raises the HTTP error the endpoint
has always answered with. They only read: a caller without a recruiter profile
has no company, so there is nothing to create.
"""

from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from ..models import RecruiterProfile
from ..models.page_access import resolve_company_page_access
from ..selectors import existing_recruiter_profile, has_explicit_company_link
from ..services import company_owners


def require_company_recruiter(user):
    """The caller's recruiter profile, linked to a real company (404 otherwise)."""
    recruiter = existing_recruiter_profile(user)
    if recruiter is None or not has_explicit_company_link(recruiter):
        raise NotFound('Bạn chưa liên kết với công ty nào.')
    return recruiter


def require_company_media_editor(user):
    """The owner (ER-D05), or a member the page policy lets edit content now.

    The refusal stays a 400 with ``detail``: the media endpoints and their
    clients have always reported it that way.
    """
    recruiter = require_company_recruiter(user)
    if (
        recruiter.company_role != RecruiterProfile.CompanyRole.OWNER
        and not resolve_company_page_access(recruiter).can_edit_content
    ):
        raise ValidationError(
            {
                'detail': (
                    'Chỉ quản lý công ty hoặc người được cấp quyền biên tập '
                    'trang công ty được thực hiện thao tác này.'
                )
            }
        )
    return recruiter


def require_company_manager(user):
    """The company ``user`` manages; only its eligible manager gets one."""
    recruiter = existing_recruiter_profile(user)
    if (
        recruiter is None
        or recruiter.company_id is None
        or not company_owners(recruiter.company).filter(pk=recruiter.pk).exists()
    ):
        raise PermissionDenied('Chỉ quản lý công ty đã xác thực mới quản lý được thành viên.')
    return recruiter.company


def caller_can_decide_join_requests(user):
    """Whether the caller is an eligible owner who may approve join requests."""
    recruiter = existing_recruiter_profile(user)
    return bool(
        recruiter is not None
        and recruiter.company_id
        and company_owners(recruiter.company).filter(user=user).exists()
    )
