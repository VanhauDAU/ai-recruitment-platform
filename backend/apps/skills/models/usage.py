"""Các bảng tham chiếu tới kỹ năng, dùng chung cho đếm lượt dùng và gộp kỹ năng."""

from .skill import Skill

# Mọi bảng tham chiếu tới kỹ năng, theo khóa hiển thị → `related_name` trên `Skill`.
# Gộp kỹ năng chuyển cả các bảng này; test buộc danh sách khớp `Skill._meta`.
USAGE_RELATIONS = {
    'jobs': 'job_skills',
    'cvs': 'cv_skills',
    'candidates': 'preferred_by_candidates',
}


def usage_relation(related_name):
    """(model tham chiếu, tên trường khóa ngoại) của một quan hệ trong `USAGE_RELATIONS`."""
    relation = Skill._meta.get_field(related_name)
    return relation.related_model, relation.field.name


def merge_rows(source, target):
    """Theo từng bảng tham chiếu: (khóa, trường, dòng của `source`, dòng sẽ bỏ).

    Dòng sẽ bỏ là dòng mà chủ của nó (tin, CV, nhu cầu tìm việc) đã có `target`.
    """
    for key, related_name in USAGE_RELATIONS.items():
        model, field = usage_relation(related_name)
        owner = merge_owner_field(model, field)
        rows = model.objects.filter(**{field: source})
        taken = model.objects.filter(**{field: target}).values(owner)
        yield key, field, rows, rows.filter(**{f'{owner}__in': taken})


def merge_preview(source, target):
    """Số dòng của từng bảng sẽ chuyển sang `target` và số dòng bỏ vì đã có `target`."""
    moved, dropped = {}, {}
    for key, _field, rows, clashing in merge_rows(source, target):
        dropped[key] = clashing.count()
        moved[key] = rows.count() - dropped[key]
    return {'moved': moved, 'dropped': dropped}


def merge_owner_field(model, field):
    """Trường "chủ" trong ràng buộc duy nhất (chủ, kỹ năng), ví dụ `job` của `JobSkill`."""
    for constraint in model._meta.constraints:
        fields = getattr(constraint, 'fields', ())
        if field in fields and len(fields) == 2:
            return next(name for name in fields if name != field)
    raise LookupError(f'{model.__name__} không có ràng buộc duy nhất (chủ, {field}).')
