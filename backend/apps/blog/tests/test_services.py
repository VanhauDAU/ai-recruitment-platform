from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User

from ..models import Post, PostCategory, Tag
from ..services import delete_tag, reorder_by_public_id


class ReorderServiceTests(TestCase):
    def setUp(self):
        self.first = PostCategory.objects.create(name='Một', order=1)
        self.second = PostCategory.objects.create(name='Hai', order=2)

    def test_sets_order_following_the_given_ids(self):
        reorder_by_public_id(PostCategory, [self.second.public_id, self.first.public_id])

        self.first.refresh_from_db()
        self.second.refresh_from_db()
        self.assertEqual((self.second.order, self.first.order), (1, 2))

    def test_rejects_missing_or_unknown_ids_without_writing(self):
        for public_ids in (None, [], [self.first.public_id, 'missing']):
            with self.subTest(public_ids=public_ids), self.assertRaises(ValidationError) as error:
                reorder_by_public_id(PostCategory, public_ids)
            self.assertIn('public_ids', error.exception.detail)
        self.first.refresh_from_db()
        self.assertEqual(self.first.order, 1)


class DeleteTagServiceTests(TestCase):
    def test_tag_in_use_is_kept(self):
        tag = Tag.objects.create(name='Phỏng vấn')
        post = Post.objects.create(
            title='Bài viết',
            category=PostCategory.objects.create(name='Kỹ năng'),
            author=User.objects.create_user(email='editor@example.com', password='Password@123'),
        )
        post.tags.add(tag)

        with self.assertRaises(ValidationError):
            delete_tag(tag)
        self.assertTrue(Tag.objects.filter(pk=tag.pk).exists())

        post.tags.clear()
        delete_tag(tag)
        self.assertFalse(Tag.objects.filter(pk=tag.pk).exists())
