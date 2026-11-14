"""Application use cases."""

from .applications import (
    InvalidReapplication,
    create_application_record,
    reapplication_error,
)
from .automatic_rejection import process_automatic_application_rejections
from .locking import RecruitmentResourceChanged
from .recruiter_cv import open_application_snapshot, record_application_cv_download
from .status import (
    InvalidApplicationStatusTransition,
    StatusChangeNotUndoable,
    available_status_decisions,
    change_application_status,
    mark_application_viewed,
    undo_latest_status_change,
    undoable_status_history,
    update_application_assessment,
)

__all__ = [
    'InvalidApplicationStatusTransition',
    'InvalidReapplication',
    'RecruitmentResourceChanged',
    'StatusChangeNotUndoable',
    'available_status_decisions',
    'change_application_status',
    'create_application_record',
    'mark_application_viewed',
    'open_application_snapshot',
    'process_automatic_application_rejections',
    'reapplication_error',
    'record_application_cv_download',
    'undo_latest_status_change',
    'undoable_status_history',
    'update_application_assessment',
]
