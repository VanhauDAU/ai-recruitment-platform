"""Recruiter profile and company-membership workflows."""

from django.utils import timezone

from ..models import RecruiterProfile


def get_or_create_recruiter(user):
    recruiter, _ = RecruiterProfile.objects.get_or_create(user=user)
    return recruiter


def review_membership(recruiter, admin_user, approve, note=''):
    """Review a recruiter request to join an existing company."""
    recruiter.membership_status = (
        RecruiterProfile.MembershipStatus.APPROVED
        if approve
        else RecruiterProfile.MembershipStatus.REJECTED
    )
    if not approve:
        recruiter.company = None
        recruiter.company_role = ''
    recruiter.membership_reviewed_by = admin_user
    recruiter.membership_reviewed_at = timezone.now()
    recruiter.membership_review_note = note
    recruiter.save()
    return recruiter
