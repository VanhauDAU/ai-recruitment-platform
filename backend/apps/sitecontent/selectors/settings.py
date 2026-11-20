"""Read site-managed configuration through a small public selector."""

import json
from functools import lru_cache
from pathlib import Path

from django.conf import settings as django_settings
from django.core.cache import cache
from django.db import connection

from common.api.params import parse_bool
from common.vietnam_time import vietnam_today

from ..models import SiteSetting

SETTINGS_CACHE_KEY = 'sitecontent:settings:all:v1'
SETTINGS_CACHE_TIMEOUT = 60 * 60
SEED_SETTINGS_PATH = Path(__file__).resolve().parents[1] / 'seed_data' / 'settings.json'


@lru_cache(maxsize=1)
def setting_registry():
    """``{key: seed row}`` from ``seed_data/settings.json``: the one source of defaults."""
    rows = json.loads(SEED_SETTINGS_PATH.read_text(encoding='utf-8'))
    return {row['key']: row for row in rows}


def _stored_values():
    """Every stored ``{key: value}``.

    Outside a transaction the committed map is cached and receivers drop it
    after each commit. Inside one, read the database so uncommitted changes of
    the same transaction are visible and never leak into the shared cache.
    """
    if connection.in_atomic_block:
        return dict(SiteSetting.objects.values_list('key', 'value'))
    values = cache.get(SETTINGS_CACHE_KEY)
    if values is None:
        values = dict(SiteSetting.objects.values_list('key', 'value'))
        cache.set(SETTINGS_CACHE_KEY, values, SETTINGS_CACHE_TIMEOUT)
    return values


def get_setting(key):
    """Stored value of ``key``; the seed default when no row exists, else ``None``."""
    values = _stored_values()
    if key in values:
        return values[key]
    row = setting_registry().get(key)
    return row['value'] if row else None


def get_string_setting(key, default=''):
    """Trimmed non-blank string value; ``default`` when blank or not a string."""
    value = get_setting(key)
    return value.strip() if isinstance(value, str) and value.strip() else default


def get_int_setting(key, default=0):
    value = get_setting(key)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def get_bool_setting(key, default=False):
    """Read an admin switch; malformed values fail closed (False)."""
    value = get_setting(key)
    if value is None:
        return default
    if isinstance(value, int) and not isinstance(value, bool):
        value = str(value)
    return parse_bool(value, False)


def get_settings_map(keys):
    """``{key: value}`` for ``keys``; keys with neither a row nor a seed default are absent."""
    values = {key: get_setting(key) for key in keys}
    return {key: value for key, value in values.items() if value is not None}


def knowledgebase_public_enabled():
    """Trung tâm trợ giúp công khai: máy chủ cho phép VÀ admin đang mở."""
    return bool(django_settings.KNOWLEDGEBASE_PUBLIC_ENABLED) and get_bool_setting(
        'knowledgebase_public_enabled', True
    )


def knowledgebase_search_index_enabled():
    """Cho index bài trợ giúp: đang mở công khai, máy chủ cho phép VÀ admin cho phép."""
    return (
        knowledgebase_public_enabled()
        and bool(django_settings.KNOWLEDGEBASE_SEARCH_INDEX_ENABLED)
        and get_bool_setting('knowledgebase_search_index_enabled', True)
    )


_BRANDING_KEYS = (
    'site_name',
    'site_tagline',
    'brand_logo_url',
    'brand_primary_color',
    'email_from_name',
    'email_footer_text',
    'support_email',
    'hotline',
    'contact_address',
    'footer_description',
    'footer_copyright',
    'footer_show_socials',
    'footer_facebook_url',
    'footer_linkedin_url',
    'footer_youtube_url',
    'footer_tiktok_url',
)
_SOCIALS = (
    ('footer_facebook_url', 'Facebook'),
    ('footer_linkedin_url', 'LinkedIn'),
    ('footer_youtube_url', 'YouTube'),
    ('footer_tiktok_url', 'TikTok'),
)


def _text(values, key, default=''):
    value = values.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else default


def email_branding():
    """Brand header/footer values shared by every product email (one query).

    ``logo_path`` is returned as stored; callers make it absolute. Socials are
    only listed when the footer is configured to show them.
    """
    values = get_settings_map(_BRANDING_KEYS)
    site_name = _text(values, 'site_name', 'ProCV')
    show_socials = values.get('footer_show_socials', True) not in (False, 'false', '0', 0)
    return {
        'site_name': site_name,
        'tagline': _text(values, 'site_tagline'),
        'logo_path': _text(values, 'brand_logo_url'),
        'primary_color': _text(values, 'brand_primary_color', '#1FA65A'),
        'from_name': _text(values, 'email_from_name', site_name),
        'footer_text': _text(values, 'email_footer_text') or _text(values, 'footer_description'),
        'support_email': _text(values, 'support_email'),
        'hotline': _text(values, 'hotline'),
        'address': _text(values, 'contact_address'),
        'copyright': _text(values, 'footer_copyright', '© {year} {site_name}')
        .replace('{year}', str(vietnam_today().year))
        .replace('{site_name}', site_name),
        'socials': [
            {'label': label, 'url': _text(values, key)}
            for key, label in _SOCIALS
            if show_socials and _text(values, key)
        ],
    }


def site_settings_by_group():
    """Non-empty ``SiteSetting.Group`` buckets in admin display order, with their area."""
    by_group = {}
    for setting in SiteSetting.objects.order_by('group', 'order', 'key'):
        by_group.setdefault(setting.group, []).append(setting)
    return [
        (group, SiteSetting.GROUP_AREAS[group], by_group[group])
        for group in SiteSetting.Group
        if group in by_group
    ]
