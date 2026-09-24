"""Application use cases."""

from .applications import (
    InvalidApplicationStatusTransition,
    InvalidReapplication,
    RecruitmentResourceChanged,
    create_application,
    create_application_record,
    mark_application_viewed,
    reapplication_error,
    update_application_status,
)
from .automatic_rejection import process_automatic_application_rejections

__all__ = [
    'InvalidApplicationStatusTransition',
    'InvalidReapplication',
    'RecruitmentResourceChanged',
    'create_application',
    'create_application_record',
    'mark_application_viewed',
    'reapplication_error',
    'update_application_status',
    'process_automatic_application_rejections',
]
