from django.test import SimpleTestCase

from common.content_html import (
    content_html_plain_text,
    safe_content_url,
    sanitize_content_html,
)


class ContentHtmlTests(SimpleTestCase):
    def test_sanitizer_drops_active_content_and_unsafe_attributes(self):
        value = sanitize_content_html(
            '<h1 onclick="bad()">Sai cấp</h1><h2 data-x="1">Hướng dẫn</h2>'
            '<script>alert(1)</script><p onmouseover="bad()">Nội dung</p>'
        )
        self.assertNotIn('<h1', value)
        self.assertNotIn('onclick', value)
        self.assertNotIn('alert', value)
        self.assertEqual(value, 'Sai cấp<h2>Hướng dẫn</h2><p>Nội dung</p>')

    def test_urls_are_https_or_safe_application_and_contact_links(self):
        self.assertEqual(safe_content_url('/tro-giup'), '/tro-giup')
        self.assertEqual(safe_content_url('https://example.com/a'), 'https://example.com/a')
        self.assertEqual(safe_content_url('mailto:help@example.com'), 'mailto:help@example.com')
        self.assertEqual(safe_content_url('tel:19001234'), 'tel:19001234')
        self.assertEqual(safe_content_url('http://example.com'), '')
        self.assertEqual(safe_content_url('//example.com'), '')
        self.assertEqual(safe_content_url('javascript:alert(1)'), '')
        self.assertEqual(safe_content_url('https://user:secret@example.com'), '')

    def test_plain_text_preserves_readable_block_boundaries(self):
        self.assertEqual(
            content_html_plain_text('<h2>Bước một</h2><p>Làm việc A.</p><p>Làm việc B.</p>'),
            'Bước một\nLàm việc A.\nLàm việc B.',
        )

    def test_layout_attributes_are_normalized(self):
        value = sanitize_content_html(
            '<img src="/media/guide.webp" alt="Màn hình" data-width="900px" data-align="fixed">'
        )
        self.assertIn('data-width="100%"', value)
        self.assertIn('data-align="center"', value)
