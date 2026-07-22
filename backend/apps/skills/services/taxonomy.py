"""Write operations for the shared skills taxonomy."""

from django.db import IntegrityError, transaction

from ..models import Skill


def create_skill(name):
    """Create a skill once, or return its existing canonical record."""
    cleaned_name = ' '.join(name.split())
    normalized_name = cleaned_name.lower()

    try:
        with transaction.atomic():
            return Skill.objects.get_or_create(
                normalized_name=normalized_name,
                defaults={'name': cleaned_name},
            )
    except IntegrityError:
        return Skill.objects.get(normalized_name=normalized_name), False
