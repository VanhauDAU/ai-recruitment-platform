"""Resolve dynamic link groups without coupling the CMS models to domains."""

import re

from django.db.models import Prefetch, prefetch_related_objects

from apps.jobs.models import JobCategory
from apps.locations.models import Location

from ..models import LinkGroup, LinkItem

_PROVINCE_PREFIX = re.compile(r'^(Thành phố|Tỉnh)\s+', re.IGNORECASE)


def _location_items(limit):
    provinces = Location.objects.filter(
        level=Location.Level.PROVINCE,
        is_active=True,
    ).order_by('name')[:limit]
    return [
        {
            'label': f'Việc làm {_PROVINCE_PREFIX.sub("", province.name)}',
            'url': f'/viec-lam?locations={province.id}',
        }
        for province in provinces
    ]


def _category_items(limit):
    categories = JobCategory.objects.filter(
        status=JobCategory.Status.ACTIVE,
    ).order_by('name')[:limit]
    return [
        {'label': f'Việc làm {category.name}', 'url': f'/viec-lam?category={category.id}'}
        for category in categories
    ]


def resolve_link_group_items(group):
    """Resolve one group, retaining a fallback for non-list serializer callers."""
    if hasattr(group, 'resolved_items'):
        return group.resolved_items
    if group.source == group.Source.LOCATIONS:
        return _location_items(group.limit)
    if group.source == group.Source.CATEGORIES:
        return _category_items(group.limit)
    items = getattr(group, 'active_items', None)
    if items is None:
        items = group.items.filter(is_active=True)
    return [{'label': item.label, 'url': item.url} for item in items]


def resolved_link_groups(*, placement=None):
    """Return public groups with at most one query for each source type."""
    queryset = LinkGroup.objects.filter(is_active=True)
    if placement:
        queryset = queryset.filter(placement=placement)
    groups = list(queryset)

    manual_groups = [group for group in groups if group.source == LinkGroup.Source.MANUAL]
    if manual_groups:
        prefetch_related_objects(
            manual_groups,
            Prefetch(
                'items',
                queryset=LinkItem.objects.filter(is_active=True),
                to_attr='active_items',
            ),
        )

    location_groups = [group for group in groups if group.source == LinkGroup.Source.LOCATIONS]
    category_groups = [group for group in groups if group.source == LinkGroup.Source.CATEGORIES]
    locations = _location_items(max((group.limit for group in location_groups), default=0))
    categories = _category_items(max((group.limit for group in category_groups), default=0))

    for group in groups:
        if group.source == LinkGroup.Source.LOCATIONS:
            group.resolved_items = locations[: group.limit]
        elif group.source == LinkGroup.Source.CATEGORIES:
            group.resolved_items = categories[: group.limit]
        else:
            group.resolved_items = [
                {'label': item.label, 'url': item.url} for item in group.active_items
            ]
    return groups
