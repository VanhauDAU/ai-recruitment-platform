"""Tín hiệu của danh mục kỹ năng cho các app phụ thuộc vào nó."""

from django.dispatch import Signal

# Gửi sau khi một kỹ năng được gộp vào kỹ năng khác, trong cùng transaction.
# Tham số: `source_id` (kỹ năng đã xóa), `target` (kỹ năng giữ lại).
skill_merged = Signal()
