"""Read-side queries for skill lookups."""

from functools import reduce
from operator import or_

from django.db.models import Q

from common.api.params import parse_int

from ..domain import normalize_skill_name
from ..models import Skill, SkillGroup

LOOKUP_CAP = 100


def active_skill_groups_queryset():
    return SkillGroup.objects.filter(is_active=True).select_related('parent')


def skill_lookup_queryset(params):
    queryset = Skill.objects.filter(is_active=True).select_related('group')
    if group := params.get('group'):
        # A malformed id matches no group (as in the locations lookup) instead of
        # reaching the ORM and failing with a 500.
        group_id = parse_int(group)
        queryset = queryset.filter(group_id=group_id) if group_id is not None else queryset.none()
    if search := params.get('search'):
        queryset = queryset.filter(name__icontains=search)
    return queryset[:LOOKUP_CAP]


def active_skill_terms():
    """`(id, name, aliases, tên nhóm)` của mọi kỹ năng đang hoạt động, cho bộ nhận diện kỹ năng."""
    return list(
        Skill.objects.filter(is_active=True)
        .order_by('id')
        .values_list('id', 'name', 'aliases', 'group__name')
    )


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
