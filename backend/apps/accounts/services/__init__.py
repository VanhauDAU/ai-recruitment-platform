"""Account-domain use cases and integrations."""

from .access import is_account_accessible
from .admin_access import (
    assign_membership,
    create_department,
    revoke_membership,
    set_department_active,
    set_primary_membership,
    set_role_active,
    set_role_permissions,
    sync_permission_catalog,
)
from .captcha import verify_recaptcha, verify_request_captcha
from .verification_delivery import queue_verification_email

__all__ = [
    'assign_membership',
    'create_department',
    'is_account_accessible',
    'queue_verification_email',
    'revoke_membership',
    'set_department_active',
    'set_primary_membership',
    'set_role_active',
    'set_role_permissions',
    'sync_permission_catalog',
    'verify_recaptcha',
    'verify_request_captcha',
]
