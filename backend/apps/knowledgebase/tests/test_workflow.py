from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.models import AdminAccessAuditLog, User
from apps.knowledgebase.models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory
from apps.knowledgebase.services import (
    KnowledgeConflict,
    approve_revision,
    archive_article,
    create_article,
    create_revision,
    normalize_revision_content,
    publish_revision,
    reject_revision,
    restore_article,
    submit_revision,
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
            source_reference='/login',
        )

    def test_full_revision_lifecycle_keeps_published_pointer_stable(self):
        article, revision = self._create()
        article, revision = submit_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article, revision = approve_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article = publish_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        first_published_at = article.first_published_at

        article, draft = create_revision(
            article=article,
            actor=self.actor,
            expected_revision_token=article.revision_token,
            change_summary='Làm rõ các bước đăng nhập.',
        )
        self.assertEqual(article.published_revision_id, revision.pk)
        article, draft = update_draft_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
            body='<h2>Các bước mới</h2><p>Nhập email và mật khẩu.</p>',
        )
        article, draft = submit_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article, draft = reject_revision(
            article=article,
            revision_number=draft.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
            review_note='Thiếu bước xử lý khi quên mật khẩu.',
        )

        article.refresh_from_db()
        self.assertEqual(article.published_revision_id, revision.pk)
        self.assertEqual(article.first_published_at, first_published_at)
        self.assertEqual(draft.status, KnowledgeArticleRevision.Status.REJECTED)
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                target_public_id=article.public_id,
                action='knowledge_revision_rejected',
            ).exists()
        )

    def test_stale_token_and_invalid_transition_are_conflicts(self):
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

        with self.assertRaises(KnowledgeConflict) as invalid:
            approve_revision(
                article=article,
                revision_number=revision.number,
                actor=self.actor,
                expected_revision_token=article.revision_token,
            )
        self.assertEqual(invalid.exception.code, 'knowledgebase_invalid_transition')

    def test_slug_type_and_category_are_locked_after_first_publish(self):
        article, revision = self._create()
        article, _ = submit_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article, _ = approve_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
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
        article, _ = submit_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
        article, _ = approve_revision(
            article=article,
            revision_number=revision.number,
            actor=self.actor,
            expected_revision_token=article.revision_token,
        )
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

    def test_content_normalization_rejects_remote_and_missing_alt_images(self):
        with self.assertRaises(ValidationError):
            normalize_revision_content(
                title='Ảnh ngoài',
                body='<p>Nội dung</p><img src="https://tracker.example/a.png" alt="Ảnh">',
                source_reference='/test',
            )

        with self.assertRaises(ValidationError):
            normalize_revision_content(
                title='Ảnh thiếu alt',
                body='<p>Nội dung</p><img src="/media/knowledgebase/content/a.webp">',
                source_reference='/test',
            )
