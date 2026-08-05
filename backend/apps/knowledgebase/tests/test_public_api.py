from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.knowledgebase.models import KnowledgeArticle, KnowledgeCategory
from apps.knowledgebase.services import (
    archive_article,
    create_article,
    update_category,
)

from .base import PublishedKnowledgeMixin


def _all_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _all_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _all_keys(child)


@override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=True)
class KnowledgebasePublicApiTests(PublishedKnowledgeMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.public_article = cls.publish_article()
        cls.guide = cls.publish_article(
            title='Cách lấy lại mật khẩu nhanh chóng',
            body='<h2>Khôi phục</h2><p>Mở trang quên mật khẩu và kiểm tra email.</p>',
            article_type=KnowledgeArticle.ArticleType.GUIDE,
            order=2,
        )
        cls.draft, _ = create_article(
            actor=cls.actor,
            category=cls.category,
            article_type=KnowledgeArticle.ArticleType.FAQ,
            title='Câu hỏi chưa duyệt',
            body='<h2>Nội bộ</h2><p>Không được công khai.</p>',
            source_reference='/internal',
        )
        cls.archived = cls.publish_article(title='Bài đã lưu trữ', order=3)
        cls.archived = archive_article(
            article=cls.archived,
            actor=cls.actor,
            expected_revision_token=cls.archived.revision_token,
        )
        cls.inactive_category = KnowledgeCategory.objects.create(
            name='Chuyên mục nội bộ',
            slug='chuyen-muc-noi-bo',
            description='Không công khai.',
            is_active=False,
            order=50,
        )
        cls.inactive_article = cls.publish_article(
            category=cls.inactive_category,
            title='Bài trong chuyên mục tắt',
        )

    def setUp(self):
        cache.clear()

    def test_public_list_exposes_only_published_approved_content_without_internal_fields(self):
        response = self.client.get(reverse('kb-public-article-list'))

        self.assertEqual(response.status_code, 200, response.data)
        public_ids = {item['public_id'] for item in response.data['results']}
        self.assertEqual(public_ids, {self.public_article.public_id, self.guide.public_id})
        forbidden = {
            'created_by',
            'submitted_by',
            'reviewed_by',
            'review_note',
            'source_reference',
            'revision_token',
            'revisions',
            'content_hash',
        }
        self.assertTrue(forbidden.isdisjoint(set(_all_keys(response.data))))
        self.assertIn('article_type', response.data['results'][0])
        self.assertNotIn('<', response.data['results'][0]['excerpt'])

    def test_search_type_validation_pagination_and_stable_filtering(self):
        searched = self.client.get(
            reverse('kb-public-article-list'),
            {'q': 'mat khau', 'type': 'guide', 'page_size': 1},
        )
        too_short = self.client.get(reverse('kb-public-article-list'), {'q': 'a'})
        too_long = self.client.get(reverse('kb-public-article-list'), {'q': 'x' * 121})
        invalid_type = self.client.get(reverse('kb-public-article-list'), {'type': 'FAQ'})
        empty_search = self.client.get(reverse('kb-public-article-list'), {'q': '  '})

        self.assertEqual(searched.status_code, 200, searched.data)
        self.assertEqual(searched.data['count'], 1)
        self.assertEqual(searched.data['results'][0]['public_id'], self.guide.public_id)
        self.assertEqual(too_short.status_code, 400)
        self.assertEqual(too_long.status_code, 400)
        self.assertEqual(invalid_type.status_code, 400)
        self.assertEqual(empty_search.status_code, 200)
        self.assertEqual(empty_search.data['count'], 2)

    def test_detail_has_navigation_but_hidden_articles_share_the_same_404(self):
        response = self.client.get(
            reverse(
                'kb-public-article-detail',
                args=[self.category.slug, self.public_article.slug],
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('<h2>', response.data['body'])
        self.assertEqual(len(response.data['related_articles']), 1)
        self.assertIsNotNone(response.data['next_article'])
        for article in (self.draft, self.archived, self.inactive_article):
            hidden = self.client.get(
                reverse(
                    'kb-public-article-detail',
                    args=[article.category.slug, article.slug],
                )
            )
            self.assertEqual(hidden.status_code, 404)

    def test_categories_count_only_public_articles(self):
        response = self.client.get(reverse('kb-public-category-list'))

        self.assertEqual(response.status_code, 200, response.data)
        by_slug = {item['slug']: item for item in response.data}
        self.assertEqual(by_slug[self.category.slug]['article_count'], 2)
        self.assertNotIn(self.inactive_category.slug, by_slug)

    def test_cache_headers_conditional_request_and_public_mutation_invalidation(self):
        url = reverse('kb-public-category-list')
        first = self.client.get(url)
        unchanged = self.client.get(url, HTTP_IF_NONE_MATCH=first['ETag'])
        update_category(
            category=self.category,
            actor=self.actor,
            expected_revision_token=self.category.revision_token,
            description='Mô tả công khai vừa cập nhật.',
        )
        changed = self.client.get(url, HTTP_IF_NONE_MATCH=first['ETag'])

        self.assertEqual(
            first['Cache-Control'],
            'public, max-age=60, stale-while-revalidate=300',
        )
        self.assertEqual(unchanged.status_code, 304)
        self.assertEqual(changed.status_code, 200)
        self.assertNotEqual(changed['ETag'], first['ETag'])

    @override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=False)
    def test_feature_switch_fails_closed_without_affecting_admin_data(self):
        self.assertEqual(
            (response := self.client.get(reverse('kb-public-category-list'))).status_code,
            404,
        )
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertTrue(KnowledgeArticle.objects.filter(pk=self.public_article.pk).exists())


@override_settings(KNOWLEDGEBASE_PUBLIC_ENABLED=True)
class KnowledgebasePublicQueryBudgetTests(PublishedKnowledgeMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.articles = [
            cls.publish_article(title=f'Câu hỏi ngân sách {index}', order=index)
            for index in range(7)
        ]

    def setUp(self):
        cache.clear()

    def test_public_query_counts_are_flat(self):
        with self.assertNumQueries(1):
            categories = self.client.get(reverse('kb-public-category-list'))
        with self.assertNumQueries(2):
            articles = self.client.get(reverse('kb-public-article-list'))
        with self.assertNumQueries(3):
            detail = self.client.get(
                reverse(
                    'kb-public-article-detail',
                    args=[self.category.slug, self.articles[3].slug],
                )
            )

        self.assertEqual(categories.status_code, 200)
        self.assertEqual(len(articles.data['results']), 7)
        self.assertEqual(len(detail.data['related_articles']), 6)
