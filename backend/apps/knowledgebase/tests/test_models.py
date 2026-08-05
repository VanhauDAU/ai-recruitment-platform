from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.accounts.models import AdminPermission
from apps.knowledgebase.models import (
    KnowledgeArticle,
    KnowledgeArticleRevision,
    KnowledgeCategory,
    KnowledgeMediaAsset,
)


class KnowledgebaseFoundationTests(TestCase):
    def test_taxonomy_and_permissions_are_seeded(self):
        self.assertEqual(KnowledgeCategory.objects.count(), 7)
        self.assertEqual(
            list(KnowledgeCategory.objects.values_list('slug', flat=True)),
            [
                'tai-khoan-va-dang-nhap',
                'bao-mat-va-quyen-rieng',
                'tim-viec-va-goi-y-viec-lam',
                'ung-tuyen-va-theo-doi-ho-so',
                'cv-va-mau-cv',
                'tim-viec-an-toan',
                'lien-he-ho-tro',
            ],
        )
        self.assertEqual(
            set(
                AdminPermission.objects.filter(module='knowledgebase').values_list(
                    'code', flat=True
                )
            ),
            {
                'knowledgebase.view',
                'knowledgebase.manage',
                'knowledgebase.review',
                'knowledgebase.publish',
            },
        )

    def test_public_identifiers_use_domain_prefixes(self):
        category = KnowledgeCategory.objects.first()
        article = KnowledgeArticle.objects.create(
            category=category,
            slug='huong-dan-thu',
        )
        revision = KnowledgeArticleRevision.objects.create(
            article=article,
            number=1,
            title='Hướng dẫn thử',
            body='<p>Nội dung</p>',
            body_plain_text='Nội dung',
            content_hash='0' * 64,
            source_reference='/test',
        )
        media = KnowledgeMediaAsset.objects.create(
            storage_key='knowledgebase/content/test.webp',
            original_name='test.webp',
            content_type='image/webp',
            size_bytes=10,
            width=10,
            height=10,
        )

        self.assertTrue(category.public_id.startswith('kbc_'))
        self.assertTrue(article.public_id.startswith('kba_'))
        self.assertTrue(revision.public_id.startswith('kbr_'))
        self.assertTrue(media.public_id.startswith('kbm_'))

    def test_only_one_open_revision_is_allowed_per_article(self):
        article = KnowledgeArticle.objects.create(
            category=KnowledgeCategory.objects.first(),
            slug='mot-ban-mo',
        )
        KnowledgeArticleRevision.objects.create(
            article=article,
            number=1,
            status=KnowledgeArticleRevision.Status.DRAFT,
            title='Revision một',
            body='<p>Nội dung</p>',
            body_plain_text='Nội dung',
            content_hash='1' * 64,
            source_reference='/test',
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            KnowledgeArticleRevision.objects.create(
                article=article,
                number=2,
                status=KnowledgeArticleRevision.Status.IN_REVIEW,
                title='Revision hai',
                body='<p>Nội dung</p>',
                body_plain_text='Nội dung',
                content_hash='2' * 64,
                source_reference='/test',
            )
