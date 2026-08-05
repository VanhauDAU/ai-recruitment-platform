from django.test import RequestFactory, SimpleTestCase, override_settings

from common.seo import SeoMetadata, render_seo_shell, sitemap_index, sitemap_urlset

SHELL = """<!doctype html>
<html lang="en"><head>
<meta data-seo-default name="description" content="old">
<title data-seo-default>Old</title>
</head><body><div id="root"></div></body></html>"""


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class SeoShellTests(SimpleTestCase):
    def test_injects_one_safe_complete_metadata_set(self):
        request = RequestFactory().get('/blog/x', HTTP_HOST='procv.vn')
        response = render_seo_shell(
            request,
            SeoMetadata(
                title='Bài <mới> | ProCV',
                description='Mô tả & chi tiết',
                canonical_url='http://procv.vn/blog/x',
                image_url='http://procv.vn/media/cover.jpg',
                structured_data=(
                    {
                        '@context': 'https://schema.org',
                        '@type': 'Article',
                        'headline': '</script><script>alert(1)</script>',
                    },
                ),
            ),
        )
        html = response.content.decode()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Language'], 'vi')
        self.assertEqual(response['X-Robots-Tag'], 'index, follow')
        self.assertIn('<html lang="vi">', html)
        self.assertIn('<title data-seo-managed="server">Bài &lt;mới&gt; | ProCV</title>', html)
        self.assertEqual(html.count('name="description"'), 1)
        self.assertEqual(html.count('rel="canonical"'), 1)
        self.assertIn('property="og:image"', html)
        self.assertNotIn('</script><script>alert(1)</script>', html)
        self.assertIn('\\u003c/script\\u003e', html)

    def test_sitemap_helpers_escape_urls(self):
        urlset = sitemap_urlset([{'loc': 'https://procv.vn/blog?a=1&b=2', 'lastmod': '2026-07-30'}])
        index = sitemap_index(['https://procv.vn/sitemaps/blog.xml?a=1&b=2'])

        self.assertIn('a=1&amp;b=2', urlset)
        self.assertIn('<lastmod>2026-07-30</lastmod>', urlset)
        self.assertIn('a=1&amp;b=2', index)
