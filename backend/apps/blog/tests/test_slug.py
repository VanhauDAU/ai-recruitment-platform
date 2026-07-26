from django.test import SimpleTestCase

from apps.blog.models.slug import friendly_post_slug


class FriendlyPostSlugTests(SimpleTestCase):
    def test_keeps_primary_search_intent_and_drops_explanatory_tail(self):
        self.assertEqual(
            friendly_post_slug('Nhân viên kinh doanh/Sales là gì? Từ A đến Z về nghề Sales'),
            'nhan-vien-sales-la-gi',
        )

    def test_limits_long_titles(self):
        slug = friendly_post_slug(
            'Cách viết CV xin việc chuyên nghiệp giúp ứng viên nổi bật với nhà tuyển dụng'
        )
        self.assertLessEqual(len(slug), 70)
        self.assertLessEqual(len(slug.split('-')), 10)
