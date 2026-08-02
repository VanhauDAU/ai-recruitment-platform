from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.blog.models import PinnedPost, Post, PostCategory, Tag
from apps.blog.selectors import blog_home_sections
from apps.speech.models import BlogSpeechAsset


class BlogPublicApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.category = PostCategory.objects.create(name='Kiến thức chuyên ngành', order=1)
        cls.other = PostCategory.objects.create(name='Bí kíp tìm việc', order=2)
        cls.tag = Tag.objects.create(name='kinh doanh')

        cls.published = Post.objects.create(
            title='Nhân viên Sales là gì?',
            category=cls.category,
            summary='Tổng quan nghề Sales.',
            content='<h2>Sales</h2><p>Nội dung</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        cls.published.tags.add(cls.tag)
        cls.draft = Post.objects.create(
            title='Bài nháp',
            category=cls.category,
            content='<p>draft</p>',
            status=Post.Status.DRAFT,
        )
        PinnedPost.objects.create(post=cls.published, order=1)
        PinnedPost.objects.create(post=cls.draft, order=2)  # nháp -> không hiện

    def test_list_returns_only_published(self):
        res = self.client.get(reverse('blog-post-list'))
        self.assertEqual(res.status_code, 200)
        slugs = [p['slug'] for p in res.data['results']]
        self.assertIn(self.published.slug, slugs)
        self.assertNotIn(self.draft.slug, slugs)
        item = next(post for post in res.data['results'] if post['slug'] == self.published.slug)
        self.assertEqual(
            set(item),
            {
                'public_id',
                'title',
                'slug',
                'excerpt',
                'thumbnail_url',
                'category',
                'published_at',
            },
        )
        self.assertEqual(set(item['category']), {'name', 'slug', 'description', 'seo_title'})
        self.assertEqual(item['excerpt'], 'Tổng quan nghề Sales.')

    def test_filter_by_category_and_tag(self):
        by_cat = self.client.get(reverse('blog-post-list'), {'category': self.category.slug})
        self.assertEqual(by_cat.data['count'], 1)
        by_other = self.client.get(reverse('blog-post-list'), {'category': self.other.slug})
        self.assertEqual(by_other.data['count'], 0)
        by_tag = self.client.get(reverse('blog-post-list'), {'tag': self.tag.slug})
        self.assertEqual(by_tag.data['count'], 1)

    def test_detail_increments_view_and_hides_draft(self):
        url = reverse('blog-post-detail', args=[self.published.slug])
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            set(res.data),
            {
                'public_id',
                'title',
                'slug',
                'thumbnail_url',
                'content',
                'summary',
                'category',
                'tags',
                'related_job_category',
                'speech_default',
                'speech_assets',
                'published_at',
                'seo_title',
                'seo_description',
            },
        )
        self.assertIsNone(res.data['speech_default'])
        self.assertEqual(res.data['speech_assets'], [])
        self.published.refresh_from_db()
        self.assertEqual(self.published.view_count, 1)
        draft = self.client.get(reverse('blog-post-detail', args=[self.draft.slug]))
        self.assertEqual(draft.status_code, 404)

    def test_detail_returns_only_the_ready_current_default_speech_asset(self):
        BlogSpeechAsset.objects.create(
            post=self.published,
            post_revision=self.published.edit_revision + 1,
            text_hash='b' * 64,
            artifact_key='b' * 64,
            config_hash='c' * 64,
            model_revision=settings.SPEECH_MODEL_REVISION,
            voice_id=settings.SPEECH_DEFAULT_VOICE_ID,
            style=settings.SPEECH_DEFAULT_STYLE,
            status=BlogSpeechAsset.Status.READY,
            storage_key=f'speech/artifacts/v2/{"b" * 64}.mp3',
            mime_type='audio/mpeg',
            duration_ms=5_000,
            size_bytes=50_000,
        )
        current = BlogSpeechAsset.objects.create(
            post=self.published,
            post_revision=self.published.edit_revision,
            text_hash='a' * 64,
            artifact_key='a' * 64,
            config_hash='c' * 64,
            model_revision=settings.SPEECH_MODEL_REVISION,
            voice_id=settings.SPEECH_DEFAULT_VOICE_ID,
            style=settings.SPEECH_DEFAULT_STYLE,
            status=BlogSpeechAsset.Status.READY,
            storage_key=f'speech/artifacts/v2/{"a" * 64}.mp3',
            mime_type='audio/mpeg',
            duration_ms=12_345,
            size_bytes=123_456,
        )

        response = self.client.get(reverse('blog-post-detail', args=[self.published.slug]))

        self.assertEqual(
            response.data['speech_default'],
            {
                'status': 'ready',
                'url': f'http://testserver/media/{current.storage_key}',
                'voice_id': settings.SPEECH_DEFAULT_VOICE_ID,
                'style': settings.SPEECH_DEFAULT_STYLE,
                'mime_type': 'audio/mpeg',
                'duration_ms': 12_345,
            },
        )
        self.assertEqual(response.data['speech_assets'], [response.data['speech_default']])

    def test_pinned_only_published(self):
        res = self.client.get(reverse('blog-pinned-list'))
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['slug'] for p in res.data], [self.published.slug])

    def test_upload_requires_permission(self):
        res = self.client.post(reverse('blog-image-upload'), {})
        self.assertIn(res.status_code, (401, 403))

    def test_home_returns_featured_and_sections(self):
        res = self.client.get(reverse('blog-home'))
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['slug'] for p in res.data['featured']], [self.published.slug])
        # Chỉ danh mục có bài published mới thành section; bài draft không tính.
        self.assertEqual(len(res.data['sections']), 1)
        section = res.data['sections'][0]
        self.assertEqual(section['category']['slug'], self.category.slug)
        self.assertEqual([p['slug'] for p in section['posts']], [self.published.slug])

    def test_home_section_query_count_is_flat_across_categories(self):
        for index in range(5):
            category = PostCategory.objects.create(name=f'Danh mục {index}', order=10 + index)
            Post.objects.create(
                title=f'Bài xuất bản {index}',
                category=category,
                content='<p>Nội dung</p>',
                status=Post.Status.PUBLISHED,
                published_at=timezone.now(),
            )

        with self.assertNumQueries(3):
            featured, sections = blog_home_sections()

        self.assertEqual(len(featured), 4)
        self.assertEqual(len(sections), 6)

    def test_home_keeps_featured_scope_and_limits_each_active_section(self):
        hidden = PostCategory.objects.create(name='Danh mục ẩn', is_active=False)
        for index in range(5):
            Post.objects.create(
                title=f'Bài chuyên ngành {index}',
                category=self.category,
                content='<p>Nội dung</p>',
                status=Post.Status.PUBLISHED,
                published_at=timezone.now(),
            )
        hidden_post = Post.objects.create(
            title='Bài thuộc danh mục ẩn',
            category=hidden,
            content='<p>Nội dung</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )

        featured, sections = blog_home_sections(per_section=4)

        self.assertIn(hidden_post.slug, [post.slug for post in featured])
        sections_by_category = {section['category'].slug: section for section in sections}
        self.assertNotIn(hidden.slug, sections_by_category)
        self.assertEqual(len(sections_by_category[self.category.slug]['posts']), 4)
