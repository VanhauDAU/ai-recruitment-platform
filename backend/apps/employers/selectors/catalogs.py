"""Read-only company catalogue lists."""

from ..models import Industry


def industries_in_use():
    """Industries at least one company works in (the public directory filter)."""
    return Industry.objects.filter(companies__isnull=False).distinct()


def industry_labels():
    return dict(Industry.objects.values_list('id', 'name'))
