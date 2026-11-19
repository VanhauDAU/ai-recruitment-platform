"""Manual ordering of blog categories and pinned posts."""

from django.db import transaction
from rest_framework.exceptions import ValidationError


def reorder_by_public_id(model, public_ids):
    """Set ``order`` 1..n following ``public_ids``; every id must exist."""
    if not isinstance(public_ids, list) or not public_ids:
        raise ValidationError({'public_ids': ['Gửi danh sách public ID theo thứ tự mong muốn.']})
    items = {item.public_id: item for item in model.objects.filter(public_id__in=public_ids)}
    if set(items) != set(public_ids):
        raise ValidationError({'public_ids': ['Danh sách chứa tài nguyên không tồn tại.']})
    with transaction.atomic():
        for order, public_id in enumerate(public_ids, start=1):
            model.objects.filter(pk=items[public_id].pk).update(order=order)
    return public_ids
