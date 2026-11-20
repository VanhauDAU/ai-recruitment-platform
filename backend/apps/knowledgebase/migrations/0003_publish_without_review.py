"""Bỏ bước gửi duyệt/duyệt/từ chối: revision chỉ còn DRAFT và PUBLISHED (ADR-0024).

Chuyển dữ liệu theo từng bài:
- revision từng xuất bản (hoặc đang được trỏ làm bản công khai) → PUBLISHED;
- revision chưa xuất bản mới nhất, mới hơn bản công khai → DRAFT (giữ phần sửa dở);
- các revision chưa từng xuất bản còn lại (bị từ chối, đã duyệt nhưng bị thay) → xóa.
Audit log vẫn giữ lịch sử thao tác cũ. Schema đổi ở 0004 (Postgres không cho ALTER
bảng còn trigger FK hoãn trong cùng transaction với lệnh xóa).
"""

from django.db import migrations

OLD_UNPUBLISHED = ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED')


def collapse_statuses(apps, schema_editor):
    Article = apps.get_model('knowledgebase', 'KnowledgeArticle')
    Revision = apps.get_model('knowledgebase', 'KnowledgeArticleRevision')
    for article in Article.objects.select_related('published_revision').iterator():
        live = article.published_revision
        revisions = list(Revision.objects.filter(article=article).order_by('-number'))
        published = [
            item
            for item in revisions
            if item.first_published_at is not None or (live and item.pk == live.pk)
        ]
        Revision.objects.filter(pk__in=[item.pk for item in published]).update(
            status='PUBLISHED'
        )
        published_ids = {item.pk for item in published}
        live_number = live.number if live else 0
        pending = [
            item
            for item in revisions
            if item.pk not in published_ids and item.status in OLD_UNPUBLISHED
        ]
        keep = next((item for item in pending if item.number > live_number), None)
        if keep:
            Revision.objects.filter(pk=keep.pk).update(status='DRAFT')
        Revision.objects.filter(
            pk__in=[item.pk for item in pending if keep is None or item.pk != keep.pk]
        ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('knowledgebase', '0002_reference_data'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='knowledgearticlerevision',
            name='uq_kb_revision_open_article',
        ),
        migrations.RunPython(collapse_statuses, migrations.RunPython.noop),
    ]
