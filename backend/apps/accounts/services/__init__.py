"""Account-domain use cases and integrations."""

from importlib import import_module

from .access import is_account_accessible, lock_account_for_write
from .admin_access import (
    assign_membership,
    confirm_department_status_change,
    confirm_membership_assignment,
    confirm_membership_revoke,
    confirm_restore_system_department,
    confirm_restore_system_role,
    confirm_role_permissions_update,
    confirm_role_status_change,
    create_department,
    create_role,
    record_admin_action,
    record_admin_self_action,
    restore_system_department,
    restore_system_role,
    revoke_membership,
    set_department_active,
    set_role_active,
    set_role_permissions,
    sync_permission_catalog,
    update_department,
    update_role,
    update_system_department_metadata,
    update_system_role_metadata,
)
from .captcha import verify_recaptcha, verify_request_captcha
from .impact_tokens import (
    InvalidImpactToken,
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
)

# Hai workflow này phụ thuộc các domain dùng lại account service. Nạp lười giữ
# public import boundary ổn định mà không tạo dependency cycle lúc package được
# import bởi sitecontent/employers.
_LAZY_EXPORTS = {
    'accept_admin_invitation': ('.account_management', 'accept_admin_invitation'),
    'confirm_account_status': ('.account_management', 'confirm_account_status'),
    'confirm_release_account_resource_holds': (
        '.account_management',
        'confirm_release_account_resource_holds',
    ),
    'confirm_account_email': ('.account_management', 'confirm_account_email'),
    'confirm_provisioning_scope_status': (
        '.account_management',
        'confirm_provisioning_scope_status',
    ),
    'confirm_revoke_account_sessions': (
        '.account_management',
        'confirm_revoke_account_sessions',
    ),
    'confirm_reset_account_mfa': (
        '.account_management',
        'confirm_reset_account_mfa',
    ),
    'create_admin_invitation': ('.account_management', 'create_admin_invitation'),
    'create_provisioning_scope': ('.account_management', 'create_provisioning_scope'),
    'ensure_account_write_allowed': (
        '.account_management',
        'ensure_account_write_allowed',
    ),
    'ensure_account_status_change_allowed': (
        '.account_management',
        'ensure_account_status_change_allowed',
    ),
    'ensure_account_recovery_allowed': (
        '.account_management',
        'ensure_account_recovery_allowed',
    ),
    'queue_account_security_email': (
        '.account_management',
        'queue_account_security_email',
    ),
    'queue_verification_email': ('.verification_delivery', 'queue_verification_email'),
    'resend_admin_invitation': ('.account_management', 'resend_admin_invitation'),
    'resolve_admin_invitation': ('.account_management', 'resolve_admin_invitation'),
    'revoke_admin_invitation': ('.account_management', 'revoke_admin_invitation'),
    'update_account_profile': ('.account_management', 'update_account_profile'),
    'update_admin_invitation_role': (
        '.account_management',
        'update_admin_invitation_role',
    ),
    'update_managed_account_profile': (
        '.account_management',
        'update_managed_account_profile',
    ),
}


def __getattr__(name):
    target = _LAZY_EXPORTS.get(name)
    if target is None:
        raise AttributeError(name)
    module_name, attribute = target
    value = getattr(import_module(module_name, __name__), attribute)
    globals()[name] = value
    return value


__all__ = [
    'assign_membership',
    'accept_admin_invitation',
    'confirm_account_status',
    'confirm_release_account_resource_holds',
    'confirm_account_email',
    'confirm_department_status_change',
    'confirm_membership_assignment',
    'confirm_membership_revoke',
    'confirm_restore_system_department',
    'confirm_restore_system_role',
    'confirm_role_permissions_update',
    'confirm_role_status_change',
    'confirm_provisioning_scope_status',
    'confirm_revoke_account_sessions',
    'confirm_reset_account_mfa',
    'create_admin_invitation',
    'create_department',
    'create_role',
    'create_provisioning_scope',
    'ensure_account_write_allowed',
    'ensure_account_status_change_allowed',
    'ensure_account_recovery_allowed',
    'InvalidImpactToken',
    'is_account_accessible',
    'lock_account_for_write',
    'queue_verification_email',
    'queue_account_security_email',
    'record_admin_action',
    'record_admin_self_action',
    'create_impact_token',
    'decode_impact_token',
    'resend_admin_invitation',
    'resolve_admin_invitation',
    'revoke_admin_invitation',
    'revoke_membership',
    'restore_system_department',
    'restore_system_role',
    'set_department_active',
    'set_role_active',
    'set_role_permissions',
    'sync_permission_catalog',
    'StaleImpactToken',
    'update_department',
    'update_account_profile',
    'update_managed_account_profile',
    'update_admin_invitation_role',
    'update_role',
    'update_system_department_metadata',
    'update_system_role_metadata',
    'verify_recaptcha',
    'verify_request_captcha',
]
