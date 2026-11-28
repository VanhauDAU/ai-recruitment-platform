"""Read-only recruitment-need queries."""


def recruiter_recruitment_needs(recruiter):
    """All of the recruiter's needs, newest first."""
    return recruiter.recruitment_needs.select_related('position_category').order_by(
        '-created_at', '-id'
    )


def recruiter_recruitment_need(recruiter, public_id):
    return recruiter.recruitment_needs.filter(public_id=public_id).first()
