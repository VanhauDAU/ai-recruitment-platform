"""Thao tác của quản trị viên trên danh mục kỹ năng: sửa, gán nhóm hàng loạt, gộp."""

from django.db import transaction
from django.utils.translation import gettext
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action
from common.errors import DomainError

from ..domain import UNCOUNTED_GROUPS, normalize_skill_name
from ..models import Skill, SkillGroup, merge_preview, merge_rows
from ..signals import skill_merged


class SkillGroupLocked(DomainError):
    code = 'skill_group_locked'


def _audit(actor, action, target, payload=None):
    record_admin_action(
        actor=actor,
        action=action,
        target_type=target.__class__.__name__,
        target_public_id=str(target.pk),
        payload=payload or {},
    )


def _clean_name(name):
    return ' '.join(str(name).split())


def _assert_free_name(name, *, exclude_pk=None):
    key = normalize_skill_name(name)
    owner = Skill.objects.exclude(pk=exclude_pk).filter(normalized_name=key).first()
    if owner is None:
        owner = next(
            (
                skill
                for skill in Skill.objects.exclude(pk=exclude_pk).filter(aliases__icontains=name)
                if key in map(normalize_skill_name, skill.aliases or [])
            ),
            None,
        )
    if owner is not None:
        raise ValidationError(
            {
                'name': gettext('“%(name)s” đã thuộc kỹ năng “%(owner)s”.')
                % {
                    'name': name,
                    'owner': owner.name,
                }
            }
        )


def _clean_aliases(aliases, *, name, exclude_pk=None):
    """Bỏ khoảng trắng thừa, mục rỗng, mục trùng nhau hoặc trùng tên; chặn tên đã thuộc kỹ năng khác."""
    cleaned, seen = [], {normalize_skill_name(name)}
    for alias in aliases:
        alias = _clean_name(alias)
        key = normalize_skill_name(alias)
        if alias and key not in seen:
            seen.add(key)
            cleaned.append(alias)
    for alias in cleaned:
        try:
            _assert_free_name(alias, exclude_pk=exclude_pk)
        except ValidationError as error:
            raise ValidationError({'aliases': error.detail['name']}) from None
    return cleaned


def create_admin_skill(*, actor, name, aliases=(), group=None, description='', is_active=True):
    name = _clean_name(name)
    _assert_free_name(name)
    skill = Skill.objects.create(
        name=name,
        aliases=_clean_aliases(aliases, name=name),
        group=group,
        description=description,
        is_active=is_active,
        source=Skill.Source.ADMIN,
    )
    _audit(actor, 'skill.create', skill, {'name': name})
    return skill


def update_skill(*, actor, skill, **changes):
    if 'name' in changes:
        changes['name'] = _clean_name(changes['name'])
        _assert_free_name(changes['name'], exclude_pk=skill.pk)
    if 'aliases' in changes:
        changes['aliases'] = _clean_aliases(
            changes['aliases'], name=changes.get('name', skill.name), exclude_pk=skill.pk
        )
    for field, value in changes.items():
        setattr(skill, field, value)
    skill.save()
    _audit(actor, 'skill.update', skill, {'fields': sorted(changes)})
    return skill


def bulk_update_skills(*, actor, skills, **changes):
    """Gán nhóm hoặc ẩn/hiện nhiều kỹ năng trong một câu lệnh."""
    ids = sorted(skill.pk for skill in skills)
    updated = Skill.objects.filter(pk__in=ids).update(**changes)
    record_admin_action(
        actor=actor,
        action='skill.bulk_update',
        target_type='Skill',
        target_public_id='',
        payload={'ids': ids, 'fields': sorted(changes)},
    )
    return updated


@transaction.atomic
def merge_skills(*, actor, source, target):
    """Gộp `source` vào `target`: chuyển mọi dòng tham chiếu, giữ tên cũ làm tên gọi khác.

    Dòng của một chủ (tin, CV, nhu cầu tìm việc) đã có sẵn `target` thì bỏ dòng của
    `source`, giữ nguyên mức yêu cầu đã khai cho `target`. Không hoàn tác được.
    """
    if source.pk == target.pk:
        raise ValidationError({'target': gettext('Hãy chọn một kỹ năng khác để gộp vào.')})
    source, target = (
        Skill.objects.select_for_update().get(pk=source.pk),
        Skill.objects.select_for_update().get(pk=target.pk),
    )
    preview = merge_preview(source, target)
    for _key, field, rows, clashing in merge_rows(source, target):
        clashing.delete()
        rows.update(**{field: target})

    keys = {normalize_skill_name(target.name)}
    aliases = []
    for alias in (*(target.aliases or []), source.name, *(source.aliases or [])):
        if normalize_skill_name(alias) not in keys:
            keys.add(normalize_skill_name(alias))
            aliases.append(alias)
    source_id, source_name = source.pk, source.name
    source.delete()
    target.aliases = aliases
    target.save(update_fields=['aliases'])
    skill_merged.send(sender=Skill, source_id=source_id, target=target)
    _audit(
        actor,
        'skill.merge',
        target,
        {'source_id': source_id, 'source_name': source_name, **preview},
    )
    return target


def save_skill_group(*, actor, group=None, **changes):
    """Tạo (khi `group` là None) hoặc sửa nhóm; hai nhóm hệ thống không đổi tên, không ẩn được."""
    if group is not None and group.name in UNCOUNTED_GROUPS:
        renamed = 'name' in changes and _clean_name(changes['name']) != group.name
        if renamed or changes.get('is_active') is False:
            raise SkillGroupLocked(
                gettext('Nhóm “%(name)s” do hệ thống đối sánh dùng nên không đổi tên hay ẩn được.')
                % {'name': group.name}
            )
    if 'name' in changes:
        changes['name'] = _clean_name(changes['name'])
        duplicate = SkillGroup.objects.filter(name__iexact=changes['name'])
        if group is not None:
            duplicate = duplicate.exclude(pk=group.pk)
        if duplicate.exists():
            raise ValidationError({'name': gettext('Đã có nhóm cùng tên.')})
    parent = changes.get('parent')
    if group is not None and parent is not None:
        ancestor = parent
        while ancestor is not None:
            if ancestor.pk == group.pk:
                raise ValidationError(
                    {
                        'parent': gettext(
                            'Nhóm cha không được là chính nhóm này hay nhóm con của nó.'
                        )
                    }
                )
            ancestor = ancestor.parent
    group = group or SkillGroup()
    for field, value in changes.items():
        setattr(group, field, value)
    group.save()
    _audit(actor, 'skill_group.save', group, {'fields': sorted(changes)})
    return group
