"""Xuất PDF CV bằng renderer frontend dùng chung (CVT-2).

Worker mở trang in ``settings.CV_PRINT_URL`` (entry ``cv-print.html`` của
frontend, dùng đúng ``CvDocumentPreview`` của preview và editor) qua engine
``common.pdf.browser``. Module độc lập với ``CvDraft`` và HTTP: chỉ render một
version bất biến hoặc document do composer tạo cho snapshot catalogue. Ảnh nền
catalogue và avatar cùng nằm trong ``cvs.CvAsset`` nên module đọc model đó.
"""

from __future__ import annotations

import base64

from django.conf import settings
from django.core.exceptions import ValidationError

from apps.cvs.models import CvAsset
from common.pdf.browser import PdfRenderingError, render_print_page_pdf

from ..domain.renderers import validate_renderer_contract


def _asset_data_uri(public_id, kind):
    if not public_id:
        return ''
    try:
        asset = CvAsset.objects.get(public_id=public_id, kind=kind, is_active=True)
        with asset.storage().open(asset.storage_key, 'rb') as stream:
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


def render_document_pdf(payload):
    """In payload của ``print_payload`` bằng trang ``cv-print.html`` của frontend."""
    return render_print_page_pdf(settings.CV_PRINT_URL, payload, entrypoint='renderCvPrint')


def render_cv_version_pdf(version) -> bytes:
    """Render một version bất biến (hoặc document snapshot) thành PDF A4."""
    return render_document_pdf(print_payload(version))
