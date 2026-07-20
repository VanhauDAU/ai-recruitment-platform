"""Recruiter profile workflows."""

from ..models import RecruiterProfile


def get_or_create_recruiter(user):
    recruiter, _ = RecruiterProfile.objects.get_or_create(user=user)
    return recruiter
