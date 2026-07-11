"""Resolve dynamic link groups without coupling the CMS models to domains."""

import re

from apps.jobs.models import JobCategory
from apps.locations.models import Location

_PROVINCE_PREFIX = re.compile(r'^(Thành phố|Tỉnh)\s+', re.IGNORECASE)


def resolve_link_group_items(group):
    if group.source == group.Source.LOCATIONS:
        provinces = Location.objects.filter(
            level=Location.Level.PROVINCE,
            is_active=True,
        ).order_by('name')[: group.limit]
        return [
            {
                'label': f'Việc làm {_PROVINCE_PREFIX.sub("", province.name)}',
                'url': f'/viec-lam?locations={province.id}',
            }
            for province in provinces
        ]
    if group.source == group.Source.CATEGORIES:
        categories = JobCategory.objects.filter(
            status=JobCategory.Status.ACTIVE,
        ).order_by('name')[: group.limit]
        return [
            {'label': f'Việc làm {category.name}', 'url': f'/viec-lam?category={category.id}'}
            for category in categories
        ]
    return [
        {'label': item.label, 'url': item.url}
        for item in group.items.filter(is_active=True)
    ]
