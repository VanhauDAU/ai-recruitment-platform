"""Xem trước và PDF thử của một phiên bản template trong wizard admin (CVT-4).

Phiên bản (kể cả bản nháp) được ghép với nội dung mẫu của vị trí đã chọn, hoặc
nội dung trống, cộng danh tính minh họa — không bao giờ dùng CV của ứng viên.
PDF thử chạy trong worker (không render PDF trong request); kết quả và cờ "đã
thử thành công" nằm trong cache, cờ gắn với cấu hình hiện tại của phiên bản nên
sửa bản nháp thì phải thử lại.
"""

import json
from hashlib import sha256
from uuid import uuid4

from django.core.cache import cache
from django.db import transaction

from apps.cvs.schemas import empty_content
from apps.cvs.services.composition import compose_cv_document
from apps.jobs.models import JobCategory

from ..demo_identity import with_demo_identity
from .position_content import resolve_position_content

TEST_PDF_TTL_SECONDS = 15 * 60
TEST_PDF_OK_TTL_SECONDS = 7 * 24 * 3600


def preview_document(
    template, version, *, locale, experience_band, position_public_id=None, theme_color=None
):
    if position_public_id:
        position = JobCategory.objects.get(public_id=position_public_id)
        content = resolve_position_content(
            position=position, locale=locale, experience_band=experience_band
        )['content_json']
    else:
        content = empty_content(locale)
    return compose_cv_document(
        template=template,
        template_version=version,
        content_json=with_demo_identity(content, locale),
        theme_color=theme_color or None,
    )


def version_fingerprint(version):
    sections = list(
        version.sections.order_by('default_order').values_list(
            'section_definition__section_key', 'region_key'
        )
    )
    payload = [
        version.renderer_key,
        version.default_layout_json,
        version.default_style_json,
        sections,
    ]
    return sha256(json.dumps(payload, sort_keys=True).encode('utf-8')).hexdigest()


def _job_key(token):
    return f'cv-test-pdf:{token}'


def _ok_key(version):
    return f'cv-test-pdf-ok:{version.pk}:{version_fingerprint(version)}'


def test_pdf_passed(version):
    return bool(cache.get(_ok_key(version)))


def request_test_pdf(version, options):
    token = uuid4().hex
    cache.set(_job_key(token), {'status': 'pending'}, TEST_PDF_TTL_SECONDS)

    def dispatch():
        from ..tasks import render_template_test_pdf

        render_template_test_pdf.delay(token, version.pk, options)

    transaction.on_commit(dispatch)
    return token


def test_pdf_job(token):
    return cache.get(_job_key(token))


def finish_test_pdf(token, version, pdf):
    cache.set(_job_key(token), {'status': 'ready', 'pdf': pdf}, TEST_PDF_TTL_SECONDS)
    cache.set(_ok_key(version), True, TEST_PDF_OK_TTL_SECONDS)


def fail_test_pdf(token):
    cache.set(_job_key(token), {'status': 'failed'}, TEST_PDF_TTL_SECONDS)
