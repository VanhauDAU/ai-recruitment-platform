"""Stable constants owned by the accounts domain."""

from .admin_departments import (
    ADMIN_DEPARTMENTS,
    system_department_definition,
    system_role_definition,
)
from .admin_permissions import ADMIN_PERMISSION_CODES, ADMIN_PERMISSIONS

__all__ = [
    'ADMIN_DEPARTMENTS',
    'ADMIN_PERMISSION_CODES',
    'ADMIN_PERMISSIONS',
    'system_department_definition',
    'system_role_definition',
]
