"""Read site-managed configuration through a small public selector."""

from common.api.params import parse_bool
from common.vietnam_time import vietnam_today

from ..models import SiteSetting


def get_string_setting(key, default=''):
    setting = SiteSetting.objects.filter(key=key).only('value').first()
    value = setting.value if setting else None
    return value if isinstance(value, str) and value.strip() else default


def get_int_setting(key, default=0):
    setting = SiteSetting.objects.filter(key=key).only('value').first()
    value = setting.value if setting else default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def get_bool_setting(key, default=False):
    """Read an admin switch; malformed values fail closed (False)."""
    value = SiteSetting.objects.filter(key=key).values_list('value', flat=True).first()
    if value is None:
        return default
    if isinstance(value, int) and not isinstance(value, bool):
        value = str(value)
    return parse_bool(value, False)


def get_settings_map(keys):
    """Read several settings in one query; missing keys are absent."""
    return dict(SiteSetting.objects.filter(key__in=keys).values_list('key', 'value'))


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
    """Every setting grouped by ``SiteSetting.Group``, in the admin display order."""
    by_group = {}
    for setting in SiteSetting.objects.order_by('group', 'order', 'key'):
        by_group.setdefault(setting.group, []).append(setting)
    return [(key, label, by_group.get(key, [])) for key, label in SiteSetting.Group.choices]
