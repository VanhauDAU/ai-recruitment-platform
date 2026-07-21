"""Read-side queries for skill lookups."""

from ..models import Skill, SkillGroup

LOOKUP_CAP = 100


def active_skill_groups_queryset():
    return SkillGroup.objects.filter(is_active=True).select_related('parent')


def skill_lookup_queryset(params):
    queryset = Skill.objects.filter(is_active=True).select_related('group')
    if group := params.get('group'):
        queryset = queryset.filter(group_id=group)
    if search := params.get('search'):
        queryset = queryset.filter(name__icontains=search)
    return queryset[:LOOKUP_CAP]
