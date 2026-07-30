from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.blog.models import Post, PostCategory

SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class BlogSeoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.category = PostCategory.objects.create(
            name='Phỏng vấn',
            description='Kinh nghiệm phỏng vấn.',
            is_active=True,
        )
        cls.post = Post.objects.create(
            title='Cách trả lời phỏng vấn',
            category=cls.category,
            summary='Chuẩn bị câu trả lời hiệu quả.',
            content='<h2>Chuẩn bị</h2><p>Nội dung bài viết.</p>',
            thumbnail_url='/media/blog/interview.jpg',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        cls.draft = Post.objects.create(
            title='Bản nháp',
            category=cls.category,
            content='<p>Nháp</p>',
            status=Post.Status.DRAFT,
        )

    def setUp(self):
        cache.clear()

    def test_article_has_canonical_open_graph_and_structured_data(self):
        response = self.client.get(reverse('seo-blog-detail', args=[self.post.slug]))
        html = response.content.decode()

        self.assertEqual(response.status_code, 200)
        self.assertIn(f'http://testserver/blog/{self.post.slug}', html)
        self.assertIn('property="og:type" content="article"', html)
        self.assertIn('"@type":"Article"', html)
        self.assertIn('"@type":"BreadcrumbList"', html)

    def test_category_metadata_and_sitemap_only_include_public_content(self):
        category = self.client.get(reverse('seo-blog-category', args=[self.category.slug]))
        sitemap = self.client.get(reverse('seo-sitemap-blog'))

        self.assertContains(category, 'Kinh nghiệm phỏng vấn.')
        self.assertContains(sitemap, self.post.slug)
        self.assertNotContains(sitemap, self.draft.slug)

    def test_draft_is_real_noindex_404(self):
        response = self.client.get(reverse('seo-blog-detail', args=[self.draft.slug]))

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
