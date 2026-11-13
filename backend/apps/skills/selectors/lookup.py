"""Read-side queries for skill lookups."""

from functools import reduce
from operator import or_

from django.db.models import Q

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


def normalize_skill_name(name):
    """Khóa so khớp tên kỹ năng, cùng quy tắc với `Skill.normalized_name`."""
    return ' '.join(str(name).split()).lower()


def skills_by_names(names):
    """Map tên kỹ năng tự do → `Skill` đang hoạt động, theo tên chuẩn hóa hoặc alias.

    Một truy vấn cho cả danh sách; tên không khớp taxonomy thì bỏ qua (không tự
    tạo kỹ năng mới).
    """
    wanted = {normalize_skill_name(name) for name in names if str(name).strip()}
    if not wanted:
        return {}
    alias_filters = [Q(aliases__contains=[name.strip()]) for name in names if str(name).strip()]
    candidates = Skill.objects.filter(is_active=True).filter(
        reduce(or_, alias_filters, Q(normalized_name__in=wanted))
    )
    matched = {}
    for skill in candidates:
        for key in (skill.normalized_name, *map(normalize_skill_name, skill.aliases or [])):
            if key in wanted:
                matched.setdefault(key, skill)
    return matched
