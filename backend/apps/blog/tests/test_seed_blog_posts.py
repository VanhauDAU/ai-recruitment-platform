from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.accounts.models import User

from ..models import PinnedPost, Post, PostStatusHistory
from ..seed_data.catalog import PINNED_SLUGS, POSTS
from ..selectors.public import pinned_posts, published_posts_queryset

SLUGS = {item['slug'] for item in POSTS}


def seed(**options):
    call_command('seed_blog_posts', stdout=StringIO(), **options)


class SeedBlogPostsTests(TestCase):
    def setUp(self):
        call_command('seed_blog', stdout=StringIO())

    def test_requires_existing_admin(self):
        with self.assertRaisesMessage(CommandError, 'createsuperuser'):
            seed()
        self.assertFalse(Post.objects.filter(slug__in=SLUGS).exists())

    def test_is_idempotent_and_publishes_through_editorial_flow(self):
        User.objects.create_superuser(email='seed-admin@example.com', password='Password@123')

        seed()
        seed()

        public = published_posts_queryset({}).filter(slug__in=SLUGS)
        self.assertEqual(public.count(), len(POSTS))
        self.assertEqual(len({item['category'] for item in POSTS}), 6)
        self.assertEqual(
            PostStatusHistory.objects.filter(post__slug__in=SLUGS, action='publish').count(),
            len(POSTS),
        )
        self.assertEqual(
            [pin.post.slug for pin in pinned_posts()],
            PINNED_SLUGS,
        )
        self.assertEqual(PinnedPost.objects.count(), len(PINNED_SLUGS))

    def test_update_flag_restores_seed_content(self):
        User.objects.create_superuser(email='seed-admin@example.com', password='Password@123')
        seed()
        post = Post.objects.get(slug=POSTS[0]['slug'])
        Post.objects.filter(pk=post.pk).update(summary='Đã sửa tay')

        seed()
        post.refresh_from_db()
        self.assertEqual(post.summary, 'Đã sửa tay')

        seed(update=True)
        post.refresh_from_db()
        self.assertEqual(post.summary, POSTS[0]['summary'])
        self.assertEqual(post.status, Post.Status.PUBLISHED)
        self.assertEqual(Post.objects.filter(slug__in=SLUGS).count(), len(POSTS))
