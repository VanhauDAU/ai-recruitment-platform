"""Đọc danh mục kỹ năng cho trang quản trị: lượt dùng, bộ lọc dọn dẹp, số đếm."""

from collections import defaultdict
from functools import reduce
from operator import add

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce

from common.api.params import parse_bool, parse_int

from ..domain import duplicate_key
from ..models import USAGE_RELATIONS, Skill, SkillGroup, usage_relation


def _usage_count(related_name):
    model, field = usage_relation(related_name)
    counts = (
        model.objects.filter(**{field: OuterRef('pk')})
        .order_by()
        .values(field)
        .annotate(total=Count('pk'))
        .values('total')
    )
    return Coalesce(Subquery(counts[:1], output_field=IntegerField()), Value(0))


def with_usage(queryset):
    """Thêm `usage_<khóa>` và `usage_total`; mỗi quan hệ một subquery nên số query không đổi."""
    counts = {f'usage_{key}': _usage_count(name) for key, name in USAGE_RELATIONS.items()}
    return queryset.annotate(**counts).annotate(usage_total=reduce(add, counts.values()))


def possible_duplicate_ids():
    """Id các kỹ năng có tên hoặc tên gọi khác trùng khóa với kỹ năng khác."""
    owners = defaultdict(set)
    for pk, name, aliases in Skill.objects.values_list('pk', 'name', 'aliases'):
        for term in (name, *(aliases or [])):
            owners[duplicate_key(term)].add(pk)
    return {pk for ids in owners.values() if len(ids) > 1 for pk in ids}


ORDERINGS = {
    'name': ('name',),
    'recent': ('-created_at', 'name'),
    'usage': ('-usage_total', 'name'),
}


def admin_skills_queryset(params):
    queryset = with_usage(Skill.objects.select_related('group'))
    if search := params.get('search', '').strip():
        queryset = queryset.filter(Q(name__icontains=search) | Q(aliases__icontains=search))
    if group := params.get('group'):
        group_id = parse_int(group)
        queryset = queryset.filter(group_id=group_id) if group_id is not None else queryset.none()
    if parse_bool(params.get('ungrouped')):
        queryset = queryset.filter(group__isnull=True)
    if source := params.get('source'):
        queryset = queryset.filter(source=source)
    if (active := params.get('is_active')) is not None:
        queryset = queryset.filter(is_active=parse_bool(active))
    if parse_bool(params.get('duplicates')):
        queryset = queryset.filter(pk__in=possible_duplicate_ids())
    return queryset.order_by(*ORDERINGS.get(params.get('ordering'), ORDERINGS['name']))


def admin_skill_summary():
    """Số đếm cho dải "Cần dọn" và các chip lọc."""
    active = Skill.objects.filter(is_active=True)
    duplicates = possible_duplicate_ids()
    return {
        'total': Skill.objects.count(),
        'ungrouped': active.filter(group__isnull=True).count(),
        'duplicates': active.filter(pk__in=duplicates).count(),
        'employer': active.filter(source=Skill.Source.EMPLOYER).count(),
        'hidden': Skill.objects.filter(is_active=False).count(),
    }


def admin_skill_groups_queryset():
    return SkillGroup.objects.select_related('parent').annotate(skill_count=Count('skills'))
