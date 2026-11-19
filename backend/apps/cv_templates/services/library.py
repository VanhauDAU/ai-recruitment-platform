"""Thư viện danh mục và màu của mẫu CV (CVT-4)."""

from rest_framework.exceptions import ValidationError


def delete_library_item(item):
    """Không xóa danh mục/màu đang được mẫu CV dùng; báo số mẫu đang dùng."""
    used = item.template_links.count()
    if used:
        raise ValidationError({'detail': f'Đang được {used} mẫu CV dùng, không xóa được.'})
    item.delete()
