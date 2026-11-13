"""Candidate-facing adapter for the canonical employer trust policy."""

from apps.employers.services import (
    BADGE_CRITERIA,
    TRUST_REPORT_REASONS,
    employer_badge_payload,
    employer_badge_state_map,
    recruiter_badge_eligibility,
)

CRITERIA_LABELS = tuple((key, label) for key, label, _ in BADGE_CRITERIA)
BADGE_CACHE_KEY = '_job_badge_cache'


def badge_state_map(badge_keys):
    return employer_badge_state_map(badge_keys)


def job_badge_criteria(job):
    if job is None or job.company_id is None or job.posted_by_id is None:
        return {
            **{key: False for key, _ in CRITERIA_LABELS},
            'verified': False,
            'policy_verified': False,
            'legacy_verified': False,
            'minimum_account_months': 6,
            'eligible_at': None,
        }
    return employer_badge_state_map({(job.company_id, job.posted_by_id)})[
        (job.company_id, job.posted_by_id)
    ]


def badge_verified_map(badge_keys):
    return {key: state['verified'] for key, state in employer_badge_state_map(badge_keys).items()}


def prime_badge_cache(context, badge_keys):
    cache = context.setdefault(BADGE_CACHE_KEY, {})
    missing = {key for key in badge_keys if all(key) and key not in cache}
    if missing:
        cache.update(badge_verified_map(missing))
    return cache


def badge_criteria_payload(job):
    return employer_badge_payload(job_badge_criteria(job), expose_failures=False)


__all__ = [
    'BADGE_CACHE_KEY',
    'CRITERIA_LABELS',
    'TRUST_REPORT_REASONS',
    'badge_criteria_payload',
    'badge_state_map',
    'badge_verified_map',
    'job_badge_criteria',
    'prime_badge_cache',
    'recruiter_badge_eligibility',
]
