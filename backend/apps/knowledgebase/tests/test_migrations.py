from importlib import import_module

from django.apps import apps
from django.test import TestCase
from django.utils import timezone

from apps.knowledgebase.models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory

collapse_statuses = import_module(
    'apps.knowledgebase.migrations.0003_publish_without_review'
).collapse_statuses


class CollapseReviewStatusesMigrationTests(TestCase):
    def _revision(self, article, number, status, *, published=False):
        return KnowledgeArticleRevision.objects.create(
            article=article,
            number=number,
            status=status,
            title=f'Revision {number}',
            body='<p>Nội dung</p>',
            body_plain_text='Nội dung',
            content_hash=f'{number:064d}',
            source_reference='/test',
            first_published_at=timezone.now() if published else None,
        )

    def test_keeps_published_history_and_only_the_newest_pending_edit(self):
        article = KnowledgeArticle.objects.create(
            category=KnowledgeCategory.objects.first(), slug='migration-kb'
        )
        r1 = self._revision(article, 1, 'APPROVED', published=True)
        r2 = self._revision(article, 2, 'REJECTED')
        r3 = self._revision(article, 3, 'APPROVED', published=True)
        r4 = self._revision(article, 4, 'REJECTED')
        r5 = self._revision(article, 5, 'IN_REVIEW')
        article.published_revision = r3
        article.save(update_fields=['published_revision'])

        collapse_statuses(apps, None)

        statuses = dict(article.revisions.values_list('number', 'status'))
        self.assertEqual(statuses, {1: 'PUBLISHED', 3: 'PUBLISHED', 5: 'DRAFT'})
        self.assertFalse(KnowledgeArticleRevision.objects.filter(pk__in=[r2.pk, r4.pk]).exists())
        self.assertTrue(KnowledgeArticleRevision.objects.filter(pk__in=[r1.pk, r5.pk]).exists())

    def test_unpublished_article_keeps_its_latest_revision_as_draft(self):
        article = KnowledgeArticle.objects.create(
            category=KnowledgeCategory.objects.first(), slug='migration-kb-draft'
        )
        self._revision(article, 1, 'REJECTED')
        self._revision(article, 2, 'APPROVED')

        collapse_statuses(apps, None)

        self.assertEqual(list(article.revisions.values_list('number', 'status')), [(2, 'DRAFT')])
