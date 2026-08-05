from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.knowledgebase.models import KnowledgeArticle
from apps.knowledgebase.services import create_article

from .base import PublishedKnowledgeMixin

SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '<meta data-seo-default name="robots" content="index, follow">'
    '</head><body><div id="root"></div></body></html>'
)


@override_settings(
    FRONTEND_SHELL_HTML=SHELL,
    KNOWLEDGEBASE_PUBLIC_ENABLED=True,
)
class KnowledgebaseSeoTests(PublishedKnowledgeMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.article = cls.publish_article()
        cls.draft, _ = create_article(
            actor=cls.actor,
            category=cls.category,
            article_type=KnowledgeArticle.ArticleType.FAQ,
            title='SEO không được lộ bản nháp',
            body='<h2>Nội bộ</h2><p>Không công khai.</p>',
            source_reference='/internal',
        )

    def setUp(self):
        cache.clear()

    def test_home_category_and_detail_are_canonical_but_noindex_during_rollout(self):
        home = self.client.get(reverse('seo-knowledge-home'))
        category = self.client.get(reverse('seo-knowledge-category', args=[self.category.slug]))
        detail = self.client.get(
            reverse(
                'seo-knowledge-detail',
                args=[self.category.slug, self.article.slug],
            )
        )
        html = detail.content.decode()

        self.assertEqual(home.status_code, 200)
        self.assertEqual(category.status_code, 200)
        self.assertEqual(detail.status_code, 200)
        for response in (home, category, detail):
            self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
            self.assertContains(response, 'name="robots" content="noindex, nofollow"')
        self.assertIn(
            f'http://testserver/tro-giup/{self.category.slug}/{self.article.slug}',
            html,
        )
        self.assertIn('property="og:type" content="article"', html)
        self.assertIn('"@type":"Article"', html)
        self.assertIn('"@type":"BreadcrumbList"', html)
        self.assertNotIn('FAQPage', html)

    def test_hidden_or_missing_content_is_real_noindex_404(self):
        draft = self.client.get(
            reverse(
                'seo-knowledge-detail',
                args=[self.category.slug, self.draft.slug],
            )
        )
        missing_category = self.client.get(
            reverse('seo-knowledge-category', args=['khong-ton-tai'])
        )

        for response in (draft, missing_category):
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')

    @override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=False)
    def test_feature_switch_returns_noindex_404_for_all_shells(self):
        response = self.client.get(reverse('seo-knowledge-home'))

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
