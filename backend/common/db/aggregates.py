"""Biểu thức ORM dùng chung cho các danh sách quản trị."""

from django.db.models import Count, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce


def related_count(model, field, **filters):
    """Subquery đếm dòng của `model` có `field` trỏ tới bản ghi ngoài.

    Mỗi bảng một subquery nên đếm nhiều quan hệ cùng lúc không nhân dòng như JOIN
    rồi COUNT, và số query của danh sách không tăng theo số bản ghi.
    """
    rows = (
        model.objects.filter(**{field: OuterRef('pk')}, **filters)
        .order_by()
        .values(field)
        .annotate(total=Count('pk'))
        .values('total')
    )
    return Coalesce(Subquery(rows[:1], output_field=IntegerField()), Value(0))
