"""Write operations for the shared skills taxonomy."""

from django.db import IntegrityError, transaction

from ..models import Skill, SkillGroup


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


def _same_name(left, right):
    return ' '.join(left.split()).lower() == ' '.join(right.split()).lower()


@transaction.atomic
def apply_skill_merge(merge):
    """Áp bảng gộp kỹ năng vào danh mục; chạy lại bao nhiêu lần cũng cho cùng kết quả.

    `merge` có hai khóa (xem `ml/labeling/skill_merge.json`):
    - `aliases`: {tên chuẩn: [cách viết khác]}: cách viết khác được nối vào `Skill.aliases`
      của kỹ năng chuẩn, để tin và CV ghi theo cách nào cũng về một kỹ năng.
    - `groups`: {tên nhóm: [tên kỹ năng]}: gán kỹ năng vào nhóm.

    Kỹ năng hoặc nhóm chưa có thì được tạo. Cách viết khác đã tồn tại thành một kỹ
    năng riêng thì không tự gộp (bản ghi đó có thể đang được tin hoặc CV dùng) mà
    trả về trong `conflicts` để người chạy xử lý.
    """
    report = {
        'skills_created': 0,
        'aliases_added': 0,
        'groups_created': 0,
        'skills_grouped': 0,
        'conflicts': [],
    }
    for canonical, variants in merge.get('aliases', {}).items():
        skill, created = create_skill(canonical)
        report['skills_created'] += created
        aliases = list(skill.aliases or [])
        for variant in variants:
            if _same_name(variant, skill.name) or any(_same_name(variant, a) for a in aliases):
                continue
            if Skill.objects.filter(normalized_name=' '.join(variant.split()).lower()).exists():
                report['conflicts'].append(variant)
                continue
            aliases.append(variant)
            report['aliases_added'] += 1
        if aliases != list(skill.aliases or []):
            skill.aliases = aliases
            skill.save(update_fields=['aliases'])
    for group_name, names in merge.get('groups', {}).items():
        group, created = SkillGroup.objects.get_or_create(name=group_name)
        report['groups_created'] += created
        for name in names:
            skill, created = create_skill(name)
            report['skills_created'] += created
            if skill.group_id != group.pk:
                skill.group = group
                skill.save(update_fields=['group'])
                report['skills_grouped'] += 1
    return report
