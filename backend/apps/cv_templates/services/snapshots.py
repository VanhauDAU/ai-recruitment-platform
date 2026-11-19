"""Xếp hàng sinh lại ảnh catalogue sau khi commit; worker ở `tasks/template_assets.py`."""

from django.db import transaction


def enqueue_template_snapshots(template):
    """Ảnh mẫu cho từng màu của một template (sau khi xuất bản hoặc admin yêu cầu)."""
    from apps.cv_templates.tasks.template_assets import generate_template_color_snapshot

    for link_id in template.color_links.values_list('pk', flat=True):
        transaction.on_commit(
            lambda link_id=link_id: generate_template_color_snapshot.delay(link_id)
        )


def enqueue_all_template_snapshots():
    """Mọi ảnh mẫu dùng chung nguồn nội dung (ví dụ khi đổi nội dung mẫu đang xuất bản)."""
    from apps.cv_templates.tasks.template_assets import regenerate_all_template_snapshots

    transaction.on_commit(regenerate_all_template_snapshots.delay)
