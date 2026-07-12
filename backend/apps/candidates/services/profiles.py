"""Write workflows for candidate profiles."""

from django.db import transaction


@transaction.atomic
def update_candidate_profile(serializer):
    """Persist a validated candidate profile update through the domain boundary."""
    return serializer.save()
