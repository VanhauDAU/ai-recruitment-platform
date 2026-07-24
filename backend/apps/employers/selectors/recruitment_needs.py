"""Read-only recruitment-need queries."""


def first_recruitment_need(recruiter):
    """Return the recruiter's earliest need with serializer relations loaded."""
    return (
        recruiter.recruitment_needs.select_related('position_category')
        .order_by('created_at', 'id')
        .first()
    )
