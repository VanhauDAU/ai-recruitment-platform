from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from ...models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory
from ...seed_data.catalog import ARTICLES, CATEGORIES, EXISTING_CATEGORY_SLUGS
from ...services import (
    create_article,
    create_category,
    create_revision,
    normalize_revision_content,
    publish_revision,
    update_article,
    update_draft_revision,
)

SEED_CHANGE_SUMMARY = 'Đồng bộ nội dung mẫu từ seed_knowledgebase.'


def resolve_actor(email=None):
    """Quản trị viên ghi audit cho mọi thao tác; lệnh không tự tạo tài khoản."""
    users = get_user_model().objects.filter(is_active=True, is_staff=True)
    if email:
        actor = users.filter(email__iexact=email).order_by('-is_superuser', 'id').first()
        if not actor:
            raise CommandError(f'Không tìm thấy tài khoản quản trị đang hoạt động: {email}')
        return actor
    actor = users.order_by('-is_superuser', 'id').first()
    if not actor:
        raise CommandError(
            'Chưa có tài khoản quản trị (is_staff). Tạo admin trước, ví dụ: '
            'python manage.py createsuperuser, rồi chạy lại lệnh.'
        )
    return actor


class Command(BaseCommand):
    help = (
        'Seed chuyên mục và bài trợ giúp mẫu cho ứng viên và nhà tuyển dụng qua luồng '
        'nháp → xuất bản (idempotent theo chuyên mục + slug).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--actor-email', help='Email tài khoản quản trị ghi audit')
        parser.add_argument(
            '--update',
            action='store_true',
            help='Xuất bản revision mới khi nội dung mẫu khác bản đang công khai',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        actor = resolve_actor(options.get('actor_email'))
        categories = self._sync_categories(actor)
        stats = dict.fromkeys(('created', 'updated', 'unchanged', 'skipped'), 0)
        for item in ARTICLES:
            result = self._upsert(item, categories[item['category']], actor, options['update'])
            stats[result] += 1
            self.stdout.write(f'{result[0]} {item["category"]}/{item["slug"]}')
        self.stdout.write(
            self.style.SUCCESS(
                'Seed trợ giúp xong: {created} tạo mới, {updated} cập nhật, '
                '{unchanged} giữ nguyên, {skipped} bỏ qua (đã lưu trữ hoặc đang có nháp).'.format(
                    **stats
                )
            )
        )

    def _sync_categories(self, actor):
        categories = {c.slug: c for c in KnowledgeCategory.objects.all()}
        missing = EXISTING_CATEGORY_SLUGS - categories.keys()
        if missing:
            raise CommandError(
                f'Thiếu chuyên mục {", ".join(sorted(missing))}. Chạy python manage.py migrate trước.'
            )
        for data in CATEGORIES:
            if data['slug'] in categories:
                continue
            categories[data['slug']] = create_category(
                actor=actor, seo_description=data['description'], **data
            )
            self.stdout.write(f'+ category {data["slug"]}')
        return categories

    def _upsert(self, item, category, actor, update):
        content = {
            'title': item['title'],
            'body': item['body'],
            'source_reference': item['source_reference'],
        }
        article = (
            KnowledgeArticle.objects.select_related('published_revision')
            .filter(category=category, slug=item['slug'])
            .first()
        )
        if article is None:
            article, revision = create_article(
                actor=actor,
                category=category,
                article_type=item['type'],
                order=item['order'],
                seo_description=item['seo_description'],
                **content,
            )
            if article.slug != item['slug']:
                # Slug sinh từ tiêu đề; chốt slug ổn định trước lần xuất bản đầu (sau đó bị khóa).
                article = update_article(
                    article=article,
                    actor=actor,
                    expected_revision_token=article.revision_token,
                    slug=item['slug'],
                )
            self._publish(article, revision.number, actor)
            return 'created'
        if article.lifecycle_state == KnowledgeArticle.LifecycleState.ARCHIVED:
            return 'skipped'

        draft = article.revisions.filter(status=KnowledgeArticleRevision.Status.DRAFT).first()
        published = article.published_revision
        if published and draft:
            # Quản trị viên đang sửa dở: không ghi đè bản nháp của họ.
            return 'skipped'
        if published and not update:
            return 'unchanged'
        if published and self._same(published, item):
            return 'unchanged'

        revision_fields = {**content, 'seo_description': item['seo_description']}
        if draft:
            article, revision = update_draft_revision(
                article=article,
                revision_number=draft.number,
                actor=actor,
                expected_revision_token=article.revision_token,
                **revision_fields,
            )
        else:
            article, revision = create_revision(
                article=article,
                actor=actor,
                expected_revision_token=article.revision_token,
                change_summary=SEED_CHANGE_SUMMARY,
                **revision_fields,
            )
        self._publish(article, revision.number, actor)
        return 'updated'

    @staticmethod
    def _same(revision, item):
        normalized = normalize_revision_content(
            title=item['title'], body=item['body'], source_reference=item['source_reference']
        )
        return (
            revision.content_hash == normalized['content_hash']
            and revision.source_reference == normalized['source_reference']
            and revision.seo_description == item['seo_description']
        )

    @staticmethod
    def _publish(article, revision_number, actor):
        article.refresh_from_db(fields=['revision_token'])
        publish_revision(
            article=article,
            revision_number=revision_number,
            actor=actor,
            expected_revision_token=article.revision_token,
        )
