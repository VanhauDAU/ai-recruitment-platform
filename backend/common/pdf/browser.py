"""Chromium headless dùng chung để in PDF (Playwright).

Một Chromium sống trong luồng engine riêng của mỗi process worker. Hai lối vào:

* ``render_print_page_pdf`` mở một trang in cùng origin, đưa payload vào bằng
  ``page.evaluate`` rồi in A4 — dùng cho CV (``cv_templates.services.printing``);
* ``render_html_pdf`` in một HTML tự chứa — dùng cho báo cáo chiến dịch.

Trang chỉ được tải tài nguyên cùng origin với trang in và ``data:``; mọi request
khác bị chặn để dữ liệu không thể bị gửi ra ngoài.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

RENDER_TIMEOUT_MS = 20_000


class PdfRenderingError(RuntimeError):
    """A worker-safe rendering failure that never includes document content."""


# Playwright sync API chạy một event loop asyncio trong luồng gọi nó; Django khi
# đó coi luồng là async context và chặn truy vấn DB. Vì vậy Chromium sống trong
# một luồng riêng của mỗi process worker; luồng Django chỉ gửi việc và chờ kết quả.
_engine = {'executor': None, 'playwright': None, 'browser': None}


def _executor():
    if _engine['executor'] is None:
        _engine['executor'] = ThreadPoolExecutor(max_workers=1, thread_name_prefix='pdf-engine')
    return _engine['executor']


def _browser():
    """Một Chromium sống trong luồng engine, khởi động lại khi bị ngắt."""
    browser = _engine['browser']
    if browser is None or not browser.is_connected():
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:  # pragma: no cover - deployment configuration
            raise PdfRenderingError('The PDF rendering engine is unavailable.') from error
        if _engine['playwright'] is None:
            _engine['playwright'] = sync_playwright().start()
        browser = _engine['playwright'].chromium.launch(args=['--disable-dev-shm-usage'])
        _engine['browser'] = browser
    return browser


def _same_origin(url, origin):
    parts = urlsplit(url)
    return parts.scheme == 'data' or (parts.scheme, parts.netloc) == origin


def _render_in_engine_thread(payload, print_url, entrypoint):
    origin = urlsplit(print_url)[:2]
    try:
        from playwright.sync_api import Error as PlaywrightError
    except ImportError as error:  # pragma: no cover - deployment configuration
        raise PdfRenderingError('The PDF rendering engine is unavailable.') from error
    context = _browser().new_context()
    try:
        context.route(
            '**/*',
            lambda route: (
                route.continue_() if _same_origin(route.request.url, origin) else route.abort()
            ),
        )
        page = context.new_page()
        page.set_default_timeout(RENDER_TIMEOUT_MS)
        page.goto(print_url, wait_until='load')
        page.evaluate(f'payload => window.{entrypoint}(payload)', payload)
        pdf = page.pdf(format='A4', print_background=True, prefer_css_page_size=True)
    except PlaywrightError as error:
        raise PdfRenderingError('The PDF rendering engine failed.') from error
    finally:
        context.close()
    if not pdf.startswith(b'%PDF'):
        raise PdfRenderingError('The PDF rendering engine returned an invalid artifact.')
    return pdf


def _render_html_in_engine_thread(html):
    try:
        from playwright.sync_api import Error as PlaywrightError
    except ImportError as error:  # pragma: no cover - deployment configuration
        raise PdfRenderingError('The PDF rendering engine is unavailable.') from error
    context = _browser().new_context()
    try:
        # Self-contained HTML only: every network request is refused.
        context.route(
            '**/*',
            lambda route: (
                route.continue_() if route.request.url.startswith('data:') else route.abort()
            ),
        )
        page = context.new_page()
        page.set_default_timeout(RENDER_TIMEOUT_MS)
        page.set_content(html, wait_until='load')
        pdf = page.pdf(format='A4', print_background=True, prefer_css_page_size=True)
    except PlaywrightError as error:
        raise PdfRenderingError('The PDF rendering engine failed.') from error
    finally:
        context.close()
    if not pdf.startswith(b'%PDF'):
        raise PdfRenderingError('The PDF rendering engine returned an invalid artifact.')
    return pdf


def render_html_pdf(html):
    """Render a self-contained HTML report (no external assets) to A4 PDF bytes.

    Used by campaign report exports.
    """
    future = _executor().submit(_render_html_in_engine_thread, html)
    return future.result(timeout=RENDER_TIMEOUT_MS / 1000 + 10)


def render_print_page_pdf(print_url, payload, *, entrypoint):
    """Open ``print_url``, hand ``payload`` to ``window.<entrypoint>`` and print A4."""
    future = _executor().submit(_render_in_engine_thread, payload, print_url, entrypoint)
    return future.result(timeout=RENDER_TIMEOUT_MS / 1000 + 10)
