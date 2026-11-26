from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.models import AdminAccessAuditLog, User
from apps.knowledgebase.models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory
from apps.knowledgebase.services import (
    KnowledgeConflict,
    archive_article,
    create_article,
    create_revision,
    discard_draft_revision,
    normalize_revision_content,
    publish_revision,
    restore_article,
    update_article,
    update_draft_revision,
)


class KnowledgeWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.actor = User.objects.create_superuser(
            email='kb-workflow@example.com', password='Password@123'
        )
        cls.category = KnowledgeCategory.objects.get(slug='tai-khoan-va-dang-nhap')

    def _create(self, title='Làm thế nào để đăng nhập?'):
        return create_article(
            actor=self.actor,
            category=self.category,
            article_type=KnowledgeArticle.ArticleType.FAQ,
            title=title,
            body='<h2>Các bước</h2><p>Mở trang đăng nhập.</p>',
            source_reference='/dang-nhap',
        )

    def test_full_revision_lifecycle_keeps_published_pointer_stable(self):
        article, revision = self._create()
        article = publish_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        first_published_at = article.first_published_at
        revision.refresh_from_db()
        self.assertEqual(revision.status, KnowledgeArticleRevision.Status.PUBLISHED)

        article, draft = create_revision(
            article=article,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article, draft = update_draft_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
            body='<h2>Các bước mới</h2><p>Nhập email và mật khẩu.</p>',
        )
        self.assertEqual(article.published_revision_id, revision.pk)

        with self.assertRaises(ValidationError) as missing_summary:
            publish_revision(
                article=article,
                revision_number=draft.number,
                actor=self.actor,
                expected_revision_token=article.revision_token,
            )
        self.assertIn('change_summary', missing_summary.exception.message_dict)

        article, draft = update_draft_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
            change_summary='Làm rõ các bước đăng nhập.',
        )
        article = publish_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        self.assertEqual(article.published_revision_id, draft.pk)
        self.assertEqual(article.first_published_at, first_published_at)

        article = publish_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        self.assertEqual(article.published_revision_id, revision.pk)
        rollback = AdminAccessAuditLog.objects.filter(
            target_public_id=article.public_id, action='knowledge_article_publish'
        ).latest('created_at')
        self.assertEqual(rollback.payload, {'revision': revision.number, 'rollback': True})

        with self.assertRaises(KnowledgeConflict) as already_public:
            publish_revision(
                article=article,
                revision_number=revision.number,
                actor=self.actor,
                expected_revision_token=article.revision_token,
            )
        self.assertEqual(already_public.exception.code, 'knowledgebase_revision_already_public')

    def test_new_draft_clones_the_latest_revision_and_can_be_discarded(self):
        article, revision = self._create()
        article = publish_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article, draft = create_revision(
            article=article,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        self.assertEqual(draft.body, revision.body)
        with self.assertRaises(KnowledgeConflict) as open_draft:
            create_revision(
                article=article, actor=self.actor, expected_revision_token=article.revision_token
            )
        self.assertEqual(open_draft.exception.code, 'knowledgebase_open_revision_exists')

        article = discard_draft_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        self.assertFalse(article.revisions.filter(number=draft.number).exists())
        self.assertEqual(article.published_revision_id, revision.pk)
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                target_public_id=article.public_id, action='knowledge_revision_discard'
            ).exists()
        )

    def test_the_only_draft_of_an_unpublished_article_cannot_be_discarded(self):
        article, revision = self._create()
        with self.assertRaises(KnowledgeConflict) as only_draft:
            discard_draft_revision(
                article=article,
                revision_number=revision.number,
                actor=self.actor,
                expected_revision_token=article.revision_token,
            )
        self.assertEqual(only_draft.exception.code, 'knowledgebase_draft_is_only_revision')

    def test_stale_token_and_foreign_revision_are_conflicts(self):
        article, revision = self._create()
        with self.assertRaises(KnowledgeConflict) as stale:
            update_draft_revision(
                article=article,
                revision_number=revision.number,
                actor=self.actor,
                expected_revision_token=999,
                title='Không được ghi đè',
            )
        self.assertEqual(stale.exception.code, 'knowledgebase_revision_stale')

        with self.assertRaises(KnowledgeConflict) as missing:
            publish_revision(
                article=article,
                revision_number=revision.number + 5,
                actor=self.actor,
                expected_revision_token=article.revision_token,
            )
        self.assertEqual(missing.exception.code, 'knowledgebase_revision_not_found')

    def test_slug_type_and_category_are_locked_after_first_publish(self):
        article, revision = self._create()
        article = publish_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )

        with self.assertRaises(ValidationError):
            update_article(
                article=article,
                actor=self.actor,
                expected_revision_token=article.revision_token,
                slug='duong-dan-moi',
            )

    def test_archive_and_restore_keep_the_published_revision(self):
        article, revision = self._create()
        article = publish_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article = archive_article(
            article=article,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        self.assertEqual(article.lifecycle_state, KnowledgeArticle.LifecycleState.ARCHIVED)
        self.assertEqual(article.published_revision_id, revision.pk)

        article = restore_article(
            article=article,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        self.assertEqual(article.lifecycle_state, KnowledgeArticle.LifecycleState.ACTIVE)
        self.assertEqual(article.published_revision_id, revision.pk)

    def test_content_normalization_accepts_https_images_without_media_upload(self):
        normalized = normalize_revision_content(
            title='Ảnh ngoài',
            body='<p>Nội dung</p><img src="https://cdn.example/a.png" alt="Ảnh hướng dẫn">',
            source_reference='/test',
        )

        self.assertIn('src="https://cdn.example/a.png"', normalized['body'])
        self.assertIn('alt="Ảnh hướng dẫn"', normalized['body'])

    def test_content_normalization_rejects_unsafe_or_missing_alt_images(self):
        with self.assertRaises(ValidationError):
            normalize_revision_content(
                title='Ảnh thiếu alt',
                body='<p>Nội dung</p><img src="/media/knowledgebase/content/a.webp">',
                source_reference='/test',
            )

        with self.assertRaises(ValidationError):
            normalize_revision_content(
                title='Ảnh HTTP',
                body='<p>Nội dung</p><img src="http://cdn.example/a.png" alt="Ảnh">',
                source_reference='/test',
            )
