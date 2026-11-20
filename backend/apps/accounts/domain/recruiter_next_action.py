"""The single "what should happen next" rule for a recruiter account.

The admin recruiter list filters, counts and sorts by this value, so it is
computed in SQL by the directory selector; this module only owns the codes
and their priority. Lower rank = more urgent. Ranks 1-3 wait on an admin,
the rest wait on the recruiter.
"""

VERIFICATION_OVERDUE = 'verification_overdue'
VERIFICATION_REVIEW = 'verification_review'
COMPANY_UPDATE_REVIEW = 'company_update_review'
ACCOUNT_RESTRICTED = 'account_restricted'
AWAITING_RESUBMISSION = 'awaiting_resubmission'
AWAITING_COMPANY = 'awaiting_company'
AWAITING_ONBOARDING = 'awaiting_onboarding'
AWAITING_SUBMISSION = 'awaiting_submission'
NONE = 'none'

NEXT_ACTION_RANKS = {
    VERIFICATION_OVERDUE: 1,
    VERIFICATION_REVIEW: 2,
    COMPANY_UPDATE_REVIEW: 3,
    ACCOUNT_RESTRICTED: 4,
    AWAITING_RESUBMISSION: 5,
    AWAITING_COMPANY: 6,
    AWAITING_ONBOARDING: 7,
    AWAITING_SUBMISSION: 8,
    NONE: 9,
}

# Filter group for "everything an admin must handle now".
ADMIN_QUEUE = 'admin_queue'
ADMIN_QUEUE_CODES = frozenset(
    code
    for code, rank in NEXT_ACTION_RANKS.items()
    if rank <= NEXT_ACTION_RANKS[COMPANY_UPDATE_REVIEW]
)


def next_action_codes(value):
    """Translate a ``next_action`` query value into the codes it selects."""
    value = (value or '').strip()
    if value == ADMIN_QUEUE:
        return ADMIN_QUEUE_CODES
    if value in NEXT_ACTION_RANKS:
        return frozenset({value})
    return frozenset()
