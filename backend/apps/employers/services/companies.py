"""Company field rules shared by creation, update requests and their review."""

import re

from django.db import transaction
from django.utils.translation import gettext as _

from common.html.plain_text import html_plain_text
from common.html.rich_text import sanitize_rich_text

from ..models import CompanyIndustry

UPDATABLE_COMPANY_FIELDS = {
    'business_type',
    'tax_code',
    'company_name',
    'trade_name',
    'trade_name_same_as_registered',
    'has_no_logo',
    'website_url',
    'has_no_website',
    'email',
    'phone',
    'address',
    'company_size',
    'description',
    'employee_benefits',
    'markets',
    'target_customers',
    'founded_year',
    'headline',
    'culture',
    'video_url',
    'social_links',
}
SENSITIVE_FIELDS = {'tax_code', 'company_name'}
COMPANY_DESCRIPTION_MIN_LENGTH = 500


def normalize_company_tax_code(value):
    """Return the canonical Vietnamese 10/13-digit tax identifier."""

    normalized = str(value or '').strip()
    if not re.fullmatch(r'(?:[0-9]{10}|[0-9]{13})', normalized):
        raise ValueError(_('Mã số thuế phải gồm đúng 10 hoặc 13 chữ số.'))
    return normalized


def normalize_company_rich_text(value, *, required, label):
    """Sanitize and validate rich text using its visible-text length."""

    if not isinstance(value, str):
        raise ValueError(_('%(label)s không hợp lệ.') % {'label': label})
    sanitized = sanitize_rich_text(value)
    visible = html_plain_text(sanitized)
    if required and not visible:
        raise ValueError(_('%(label)s là bắt buộc.') % {'label': label})
    if required and len(visible) < COMPANY_DESCRIPTION_MIN_LENGTH:
        raise ValueError(
            _('%(label)s phải có ít nhất %(min)s ký tự.')
            % {'label': label, 'min': COMPANY_DESCRIPTION_MIN_LENGTH}
        )
    if len(visible) > 10_000:
        raise ValueError(_('%(label)s không được vượt quá 10.000 ký tự.') % {'label': label})
    return sanitized


@transaction.atomic
def set_company_industries(company, industries, primary_industry):
    """Replace a company's industry assignments atomically."""
    company.company_industries.all().delete()
    CompanyIndustry.objects.bulk_create(
        [
            CompanyIndustry(
                company=company,
                industry=industry,
                is_primary=industry == primary_industry,
            )
            for industry in industries
        ]
    )
