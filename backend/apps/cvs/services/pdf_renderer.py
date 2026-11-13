"""Xuất PDF CV bằng Chromium headless và renderer frontend dùng chung (CVT-2).

Worker mở trang in `settings.CV_PRINT_URL` (entry `cv-print.html` của frontend,
dùng đúng `CvDocumentPreview` của preview và editor), đưa document vào trang bằng
`page.evaluate` rồi in A4 — dữ liệu CV không đi qua mạng và trang in không tự
tải gì. Trang chỉ được tải tài nguyên cùng origin với trang in và `data:`; mọi
request khác bị chặn để nội dung CV không thể bị gửi ra ngoài.

Module độc lập với `CvDraft` và HTTP: chỉ render một version bất biến (hoặc
document do composer tạo cho snapshot catalogue).
"""

from __future__ import annotations

import base64
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ValidationError

from apps.cv_templates.renderers import validate_renderer_contract
from common.r2_storage import cv_asset_storage

from ..models import CvAsset

RENDER_TIMEOUT_MS = 20_000


class PdfRenderingError(RuntimeError):
    """A worker-safe rendering failure that never includes CV content."""


# Playwright sync API chạy một event loop asyncio trong luồng gọi nó; Django khi
# đó coi luồng là async context và chặn truy vấn DB. Vì vậy Chromium sống trong
# một luồng riêng của mỗi process worker; luồng Django chỉ gửi việc và chờ kết quả.
_engine = {'executor': None, 'playwright': None, 'browser': None}


def _executor():
    if _engine['executor'] is None:
        _engine['executor'] = ThreadPoolExecutor(max_workers=1, thread_name_prefix='cv-pdf')
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


def _asset_data_uri(public_id, kind):
    if not public_id:
        return ''
    try:
        asset = CvAsset.objects.get(public_id=public_id, kind=kind, is_active=True)
        with cv_asset_storage(asset).open(asset.storage_key, 'rb') as stream:
            encoded = base64.b64encode(stream.read()).decode('ascii')
    except (CvAsset.DoesNotExist, OSError):
        return ''
    return f'data:{asset.content_type};base64,{encoded}'


def print_payload(version):
    """Payload của trang in: document, khóa layout và ảnh dạng data URI."""
    template_version = version.template_version
    if template_version is None:
        raise PdfRenderingError('The selected CV version has no pinned template renderer.')
    regions = [
        region.get('id')
        for region in version.layout_json.get('regions', [])
        if isinstance(region, dict)
    ]
    try:
        contract = validate_renderer_contract(
            template_version.renderer_key, version.schema_version, regions
        )
    except ValidationError as error:
        raise PdfRenderingError(
            'The selected CV version does not satisfy its renderer contract.'
        ) from error
    personal_info = version.content_json.get('personal_info', {})
    assets = {}
    for public_id, kind in (
        (personal_info.get('avatar_asset_id'), CvAsset.Kind.AVATAR),
        (version.style_json.get('background_asset_id'), CvAsset.Kind.BACKGROUND),
    ):
        data_uri = _asset_data_uri(public_id, kind)
        if data_uri:
            assets[public_id] = {'url': data_uri}
    return {
        'renderer_key': contract.key,
        'document': {
            'schema_version': version.schema_version,
            'content_json': version.content_json,
            'layout_json': version.layout_json,
            'style_json': version.style_json,
        },
        'assets': assets,
    }


def _same_origin(url, origin):
    parts = urlsplit(url)
    return parts.scheme == 'data' or (parts.scheme, parts.netloc) == origin


def _render_in_engine_thread(payload, print_url):
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
        page.evaluate('payload => window.renderCvPrint(payload)', payload)
        pdf = page.pdf(format='A4', print_background=True, prefer_css_page_size=True)
    except PlaywrightError as error:
        raise PdfRenderingError('The PDF rendering engine failed.') from error
    finally:
        context.close()
    if not pdf.startswith(b'%PDF'):
        raise PdfRenderingError('The PDF rendering engine returned an invalid artifact.')
    return pdf


def render_document_pdf(payload):
    future = _executor().submit(_render_in_engine_thread, payload, settings.CV_PRINT_URL)
    return future.result(timeout=RENDER_TIMEOUT_MS / 1000 + 10)


def render_cv_version_pdf(version) -> bytes:
    """Render một version bất biến (hoặc document snapshot) thành PDF A4."""
    return render_document_pdf(print_payload(version))
