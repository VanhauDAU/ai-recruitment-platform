"""Flat-query contract for the knowledgebase administrator list."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.knowledgebase.models import (
    KnowledgeArticle,
    KnowledgeArticleRevision,
    KnowledgeCategory,
)

ADMIN_KNOWLEDGE_ARTICLE_LIST_QUERY_BUDGET = 3


class KnowledgebaseQueryBudgetTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='kb-budget@example.com', password='Password@123'
        )
        category = KnowledgeCategory.objects.get(slug='tai-khoan-va-dang-nhap')
        for index in range(5):
            article = KnowledgeArticle.objects.create(
                category=category,
                slug=f'bai-ngan-sach-{index}',
                created_by=self.admin,
            )
            KnowledgeArticleRevision.objects.create(
                article=article,
                number=1,
                title=f'Bài ngân sách {index}',
                body='<p>Nội dung</p>',
                body_plain_text='Nội dung',
                content_hash=str(index) * 64,
                source_reference='/test',
                created_by=self.admin,
            )
        self.client.force_authenticate(self.admin)

    def test_admin_article_list_query_count_is_flat(self):
        # 1 COUNT pagination + 1 SELECT article/category/published revision +
        # 1 batched prefetch cho toàn bộ revision/actor của trang.
        with self.assertNumQueries(ADMIN_KNOWLEDGE_ARTICLE_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('kb-admin-article-list'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['results']), 5)
