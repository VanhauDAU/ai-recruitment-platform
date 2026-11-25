"""Application use cases."""

from .applications import (
    ApplicationNotAllowed,
    ApplicationNotFound,
    create_application_record,
    reapplication_error,
    withdraw_application,
)
from .automatic_rejection import process_automatic_application_rejections
from .blocks import (
    BLOCKED_APPLY_MESSAGE,
    CandidateAlreadyBlocked,
    block_candidate,
    is_candidate_blocked,
    is_candidate_blocked_for_job,
    lift_candidate_block,
)
from .candidate_search import (
    candidate_detail,
    invite_candidate,
    respond_to_search_invitation,
    search_candidates,
)
from .flash_badge import refresh_flash_badges
from .locking import RecruitmentResourceChanged
from .policy import candidate_reminder_policy
from .recruiter_alerts import alert_recruiter_of_application, send_new_application_email
from .recruiter_cv import (
    open_application_cv_file,
    open_application_snapshot,
    record_application_cv_download,
)
from .reminders import (
    candidate_reminder_available_at,
    request_recruiter_reminder,
    send_unanswered_application_reminders,
)
from .reviews import (
    ReviewLinkUnavailable,
    ReviewNotShareable,
    create_review_link,
    deidentified_content,
    open_review_link,
    revoke_review_link,
    submit_review,
)
from .rules import application_rules
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
from .talent_pool import (
    TalentPoolConflict,
    add_to_talent_pool,
    invite_to_apply,
    purge_lapsed_talent_pool_entries,
    remove_from_talent_pool,
    update_talent_pool_entry,
    withdraw_from_talent_pool,
)

__all__ = [
    'candidate_detail',
    'invite_candidate',
    'respond_to_search_invitation',
    'search_candidates',
    'application_rules',
    'candidate_reminder_available_at',
    'candidate_reminder_policy',
    'request_recruiter_reminder',
    'send_unanswered_application_reminders',
    'refresh_flash_badges',
    'alert_recruiter_of_application',
    'send_new_application_email',
    'TalentPoolConflict',
    'add_to_talent_pool',
    'invite_to_apply',
    'purge_lapsed_talent_pool_entries',
    'remove_from_talent_pool',
    'update_talent_pool_entry',
    'withdraw_from_talent_pool',
    'BLOCKED_APPLY_MESSAGE',
    'CandidateAlreadyBlocked',
    'block_candidate',
    'is_candidate_blocked',
    'is_candidate_blocked_for_job',
    'lift_candidate_block',
    'InvalidApplicationStatusTransition',
    'ApplicationNotAllowed',
    'ApplicationNotFound',
    'RecruitmentResourceChanged',
    'ReviewLinkUnavailable',
    'ReviewNotShareable',
    'StatusChangeNotUndoable',
    'available_status_decisions',
    'change_application_status',
    'create_application_record',
    'withdraw_application',
    'create_review_link',
    'deidentified_content',
    'mark_application_viewed',
    'open_application_cv_file',
    'open_application_snapshot',
    'open_review_link',
    'process_automatic_application_rejections',
    'reapplication_error',
    'record_application_cv_download',
    'revoke_review_link',
    'submit_review',
    'undo_latest_status_change',
    'undoable_status_history',
    'update_application_assessment',
]
