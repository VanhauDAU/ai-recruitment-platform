"""Xuất PDF bằng Chromium + trang in frontend (CVT-2).

Test không chạy Chromium thật: trang in là code frontend (đã có test riêng) và CI
backend không có frontend. Ở đây kiểm tra payload đưa vào trang, giới hạn mạng
của trang in và cách báo lỗi không lộ nội dung CV.
"""

import threading
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from ..schemas import empty_content, empty_layout, empty_style
from ..services import pdf_renderer
from ..services.pdf_renderer import PdfRenderingError, print_payload, render_cv_version_pdf

PRINT_URL = 'http://frontend:5173/cv-print.html'


def version(renderer_key='single_column_v1', regions=('main',)):
    content = empty_content()
    content['sections'] = [
        {
            'instance_id': 'summary_1',
            'section_key': 'summary',
            'title': 'Mục tiêu nghề nghiệp',
            'enabled': True,
            'items': [{'item_id': 'summary_item_1', 'value': 'Bí mật của ứng viên'}],
        }
    ]
    layout = empty_layout()
    layout['regions'] = [
        {'id': region, 'row': 0, 'width_percent': 100 // len(regions), 'section_instance_ids': []}
        for region in regions
    ]
    layout['regions'][0]['section_instance_ids'] = ['summary_1']
    return SimpleNamespace(
        template_version=SimpleNamespace(renderer_key=renderer_key, renderer_version='1'),
        schema_version=1,
        content_json=content,
        layout_json=layout,
        style_json=empty_style(),
    )


class FakeChromium:
    """Ghi lại cách service dùng Playwright mà không cần trình duyệt."""

    def __init__(self, pdf=b'%PDF-1.7 fake'):
        self.page = MagicMock()
        self.page.pdf.return_value = pdf
        self.context = MagicMock()
        self.context.new_page.return_value = self.page
        self.browser = MagicMock()
        self.browser.new_context.return_value = self.context

    def route_handler(self):
        return self.context.route.call_args.args[1]


@override_settings(CV_PRINT_URL=PRINT_URL)
class CvPdfRendererTests(SimpleTestCase):
    def render(self, chromium, cv_version):
        with patch.object(pdf_renderer, '_browser', return_value=chromium.browser):
            return render_cv_version_pdf(cv_version)

    def test_payload_carries_the_pinned_layout_and_untouched_document(self):
        cv_version = version('sidebar_right_v1', regions=('main', 'sidebar'))

        payload = print_payload(cv_version)

        self.assertEqual(payload['renderer_key'], 'sidebar_right_v1')
        self.assertEqual(payload['document']['content_json'], cv_version.content_json)
        self.assertEqual(payload['document']['layout_json'], cv_version.layout_json)
        self.assertEqual(payload['assets'], {})

    def test_unknown_layout_or_region_is_refused_before_rendering(self):
        with self.assertRaises(PdfRenderingError):
            print_payload(version('legacy_layout_v9'))
        with self.assertRaises(PdfRenderingError):
            print_payload(version('single_column_v1', regions=('main', 'sidebar')))

    def test_document_is_injected_into_the_print_page_and_printed_as_a4(self):
        chromium = FakeChromium()
        cv_version = version()

        pdf = self.render(chromium, cv_version)

        self.assertTrue(pdf.startswith(b'%PDF'))
        chromium.page.goto.assert_called_once_with(PRINT_URL, wait_until='load')
        script, payload = chromium.page.evaluate.call_args.args
        self.assertIn('renderCvPrint', script)
        self.assertEqual(payload, print_payload(cv_version))
        self.assertEqual(chromium.page.pdf.call_args.kwargs['format'], 'A4')
        chromium.context.close.assert_called_once()

    def test_print_page_can_only_reach_its_own_origin_and_data_urls(self):
        chromium = FakeChromium()
        self.render(chromium, version())
        handler = chromium.route_handler()

        for url, allowed in (
            ('http://frontend:5173/src/app/print/cv-print.jsx', True),
            ('data:image/png;base64,AAAA', True),
            ('https://attacker.example/collect?cv=1', False),
            ('http://frontend:9999/other', False),
        ):
            route = MagicMock()
            route.request.url = url
            handler(route)
            self.assertEqual(route.continue_.called, allowed, url)
            self.assertEqual(route.abort.called, not allowed, url)

    def test_engine_failures_are_reported_without_cv_content(self):
        from playwright.sync_api import Error as PlaywrightError

        chromium = FakeChromium()
        chromium.page.evaluate.side_effect = PlaywrightError('Bí mật của ứng viên')

        with self.assertRaises(PdfRenderingError) as raised:
            self.render(chromium, version())

        self.assertNotIn('Bí mật', str(raised.exception))
        chromium.context.close.assert_called_once()

    def test_non_pdf_output_is_rejected(self):
        with self.assertRaises(PdfRenderingError):
            self.render(FakeChromium(pdf=b'<html>'), version())

    def test_chromium_runs_outside_the_django_thread(self):
        """Playwright sync API leaves an event loop in its thread; Django would then
        refuse database queries there, so rendering must use the engine thread."""
        threads = []

        def fake_engine(payload, print_url):
            threads.append(threading.get_ident())
            return b'%PDF-1.7'

        with patch.object(pdf_renderer, '_render_in_engine_thread', side_effect=fake_engine):
            pdf_renderer.render_document_pdf({'renderer_key': 'single_column_v1'})

        self.assertNotEqual(threads, [threading.get_ident()])
