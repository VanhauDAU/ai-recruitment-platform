"""Validation and storage of company page content (ADR-0017, ER-D59).

Submissions and approvals both run ``normalize_page_content_changes``: what
reaches the public page was checked when it was sent and again when an admin
applied it, so a benefit retired or a rule tightened in between cannot slip in.
"""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.jobs.models import Benefit
from apps.locations.models import Location
from common.rich_text import rich_text_plain_text, sanitize_rich_text

from ..models import CompanyBenefit, CompanyOffice
from ..page_content import (
    BENEFIT_LIMIT,
    HEADLINE_MAX_LENGTH,
    OFFICE_LIMIT,
    SOCIAL_NETWORKS,
    SOCIAL_NETWORKS_BY_KEY,
    normalize_social_link,
    normalize_video_url,
)

# Content only an effective page editor may submit; the older profile fields
# stay open to every member (ER-D05).
PAGE_CONTENT_FIELDS = frozenset(
    {'headline', 'culture', 'video_url', 'social_links', 'benefits', 'offices'}
)
CULTURE_MAX_LENGTH = 5000
BENEFIT_NOTE_MAX_LENGTH = 160
OFFICE_LABEL_MAX_LENGTH = 120
OFFICE_ADDRESS_MAX_LENGTH = 255


def _plain_text(value, *, max_length, label, required=False):
    """One line of plain text; markup is refused rather than silently dropped."""
    if not isinstance(value, str):
        raise ValueError(f'{label} không hợp lệ.')
    text = ' '.join(value.split())
    if '<' in text or '>' in text:
        raise ValueError(f'{label} không được chứa thẻ HTML.')
    if required and not text:
        raise ValueError(f'{label} là bắt buộc.')
    if len(text) > max_length:
        raise ValueError(f'{label} không được vượt quá {max_length} ký tự.')
    return text


def _culture(value):
    if not isinstance(value, str):
        raise ValueError('Văn hoá công ty không hợp lệ.')
    sanitized = sanitize_rich_text(value)
    if len(rich_text_plain_text(sanitized)) > CULTURE_MAX_LENGTH:
        raise ValueError(f'Văn hoá công ty không được vượt quá {CULTURE_MAX_LENGTH} ký tự.')
    return sanitized


def _social_links(value):
    if not isinstance(value, dict):
        raise ValidationError({'social_links': ['Danh sách mạng xã hội không hợp lệ.']})
    if unknown := sorted(set(value) - set(SOCIAL_NETWORKS_BY_KEY)):
        raise ValidationError(
            {'social_links': [f'Mạng xã hội không được hỗ trợ: {", ".join(unknown)}.']}
        )
    links, errors = {}, {}
    for network in SOCIAL_NETWORKS:
        url = value.get(network.key) or ''
        if not isinstance(url, str):
            errors[network.key] = ['Đường dẫn không hợp lệ.']
        elif url.strip():
            try:
                links[network.key] = normalize_social_link(network, url)
            except ValueError as error:
                errors[network.key] = [str(error)]
    if errors:
        raise ValidationError({'social_links': errors})
    return links


def _list_of_dicts(field, value, *, limit, label):
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise ValidationError({field: [f'Danh sách {label} không hợp lệ.']})
    if len(value) > limit:
        raise ValidationError({field: [f'Tối đa {limit} {label}.']})
    return value


def _benefits(value):
    items = _list_of_dicts('benefits', value, limit=BENEFIT_LIMIT, label='phúc lợi')
    ids = [item.get('benefit_id') for item in items]
    active_ids = set(
        Benefit.objects.filter(
            is_active=True,
            id__in=[benefit_id for benefit_id in ids if isinstance(benefit_id, int)],
        ).values_list('id', flat=True)
    )
    cleaned, errors, seen = [], {}, set()
    for index, item in enumerate(items):
        benefit_id = item.get('benefit_id')
        item_errors = {}
        if not isinstance(benefit_id, int) or benefit_id not in active_ids:
            item_errors['benefit_id'] = ['Phúc lợi không có trong danh mục.']
        elif benefit_id in seen:
            item_errors['benefit_id'] = ['Mỗi phúc lợi chỉ được chọn một lần.']
        try:
            note = _plain_text(
                item.get('note', ''),
                max_length=BENEFIT_NOTE_MAX_LENGTH,
                label='Ghi chú',
            )
        except ValueError as error:
            item_errors['note'] = [str(error)]
        if item_errors:
            errors[index] = item_errors
            continue
        seen.add(benefit_id)
        cleaned.append({'benefit_id': benefit_id, 'note': note})
    if errors:
        raise ValidationError({'benefits': errors})
    return cleaned


def _offices(value):
    items = _list_of_dicts('offices', value, limit=OFFICE_LIMIT, label='văn phòng')
    requested_ids = [item.get('province_id') for item in items]
    province_ids = set(
        Location.objects.filter(
            level=Location.Level.PROVINCE,
            id__in=[value for value in requested_ids if isinstance(value, int)],
        ).values_list('id', flat=True)
    )
    cleaned, errors = [], {}
    for index, item in enumerate(items):
        item_errors = {}
        texts = {}
        for key, max_length, label in (
            ('label', OFFICE_LABEL_MAX_LENGTH, 'Tên văn phòng'),
            ('address_line', OFFICE_ADDRESS_MAX_LENGTH, 'Địa chỉ'),
        ):
            try:
                texts[key] = _plain_text(
                    item.get(key, ''),
                    max_length=max_length,
                    label=label,
                    required=True,
                )
            except ValueError as error:
                item_errors[key] = [str(error)]
        province_id = item.get('province_id')
        if not isinstance(province_id, int) or province_id not in province_ids:
            item_errors['province_id'] = ['Chọn tỉnh/thành phố của văn phòng.']
        is_headquarters = item.get('is_headquarters', False)
        if not isinstance(is_headquarters, bool):
            item_errors['is_headquarters'] = ['Giá trị trụ sở chính không hợp lệ.']
        if item_errors:
            errors[index] = item_errors
            continue
        cleaned.append({**texts, 'province_id': province_id, 'is_headquarters': is_headquarters})
    if errors:
        raise ValidationError({'offices': errors})
    if sum(office['is_headquarters'] for office in cleaned) > 1:
        raise ValidationError({'offices': ['Chỉ một văn phòng được đánh dấu là trụ sở chính.']})
    return cleaned


def _headline(value):
    return _plain_text(value, max_length=HEADLINE_MAX_LENGTH, label='Khẩu hiệu')


def _video_url(value):
    if not isinstance(value, str):
        raise ValueError('Đường dẫn video không hợp lệ.')
    return normalize_video_url(value)


_TEXT_NORMALIZERS = {'headline': _headline, 'culture': _culture, 'video_url': _video_url}
_STRUCTURED_NORMALIZERS = {
    'social_links': _social_links,
    'benefits': _benefits,
    'offices': _offices,
}


def normalize_page_content_changes(changes):
    """Return ``changes`` with every page content key validated and canonical."""
    cleaned = dict(changes)
    for field, normalize in _TEXT_NORMALIZERS.items():
        if field not in cleaned:
            continue
        try:
            cleaned[field] = normalize(cleaned[field])
        except ValueError as error:
            raise ValidationError({field: [str(error)]}) from error
    for field, normalize in _STRUCTURED_NORMALIZERS.items():
        if field in cleaned:
            cleaned[field] = normalize(cleaned[field])
    return cleaned


def company_benefit_values(company):
    """Published benefits in the shape submissions store them."""
    return [
        {'benefit_id': item.benefit_id, 'note': item.note}
        for item in CompanyBenefit.objects.filter(company=company).order_by('sort_order', 'id')
    ]


def company_office_values(company):
    """Published offices in the shape submissions store them."""
    return [
        {
            'label': office.label,
            'address_line': office.address_line,
            'province_id': office.province_id,
            'is_headquarters': office.is_headquarters,
        }
        for office in CompanyOffice.objects.filter(company=company).order_by('sort_order', 'id')
    ]


@transaction.atomic
def replace_company_benefits(company, benefits):
    """Replace the published benefits atomically, like ``set_company_industries``."""
    CompanyBenefit.objects.filter(company=company).delete()
    CompanyBenefit.objects.bulk_create(
        CompanyBenefit(company=company, sort_order=position, **item)
        for position, item in enumerate(benefits)
    )


@transaction.atomic
def replace_company_offices(company, offices):
    CompanyOffice.objects.filter(company=company).delete()
    for position, item in enumerate(offices):
        # save() mints the public id, which bulk_create would skip.
        CompanyOffice.objects.create(company=company, sort_order=position, **item)
