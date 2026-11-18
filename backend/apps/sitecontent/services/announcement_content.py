"""Normalisation and validation of announcement revision content."""

import re
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError

from apps.accounts.models import User

from ..models import (
    AnnouncementRevision,
)

HEX_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')


def validate_hex_color(value, *, field_name):
    color = (value or '').strip()
    if not color:
        return ''
    if not HEX_COLOR_RE.fullmatch(color):
        raise ValidationError({field_name: 'Màu phải dạng #RRGGBB.'})
    return color.upper()


def normalize_theme_and_background(data):
    """Chuẩn hóa visual fields revision (theme + ảnh nền)."""
    normalized = dict(data)
    theme_mode = (normalized.get('theme_mode') or AnnouncementRevision.ThemeMode.KIND).strip()
    if theme_mode not in AnnouncementRevision.ThemeMode.values:
        raise ValidationError({'theme_mode': 'Chế độ theme không hợp lệ.'})
    normalized['theme_mode'] = theme_mode

    preset = (normalized.get('theme_preset') or '').strip()
    if theme_mode == AnnouncementRevision.ThemeMode.PRESET:
        if preset not in AnnouncementRevision.ThemePreset.values:
            raise ValidationError({'theme_preset': 'Chọn preset màu hợp lệ.'})
        normalized['theme_preset'] = preset
        # Custom colors unused in preset mode.
        for field in ('color_accent', 'color_bg_from', 'color_bg_to', 'color_fg'):
            normalized[field] = ''
    elif theme_mode == AnnouncementRevision.ThemeMode.CUSTOM:
        normalized['theme_preset'] = ''
        colors = {}
        for field in ('color_accent', 'color_bg_from', 'color_bg_to', 'color_fg'):
            colors[field] = validate_hex_color(normalized.get(field), field_name=field)
        if not any(colors.values()):
            raise ValidationError({'color_accent': 'Theme custom cần ít nhất một màu #RRGGBB.'})
        normalized.update(colors)
    else:
        # kind: strip custom/preset so feed fallback pure kind CSS.
        normalized['theme_preset'] = ''
        for field in ('color_accent', 'color_bg_from', 'color_bg_to', 'color_fg'):
            normalized[field] = ''

    image = (normalized.get('background_image') or '').strip()
    if image:
        if image.startswith('/') or '://' in image or '..' in image:
            raise ValidationError(
                {'background_image': 'Chỉ nhận storage key nội bộ, không nhận URL.'}
            )
        normalized['background_image'] = image
    else:
        normalized['background_image'] = ''

    defaults = {
        'background_fit': AnnouncementRevision.BackgroundFit.COVER,
        'background_position': AnnouncementRevision.BackgroundPosition.CENTER,
        'background_overlay': AnnouncementRevision.BackgroundOverlay.NONE,
    }
    for field, choices in (
        ('background_fit', AnnouncementRevision.BackgroundFit.values),
        ('background_position', AnnouncementRevision.BackgroundPosition.values),
        ('background_overlay', AnnouncementRevision.BackgroundOverlay.values),
    ):
        value = (normalized.get(field) or defaults[field]).strip()
        if value not in choices:
            raise ValidationError({field: 'Giá trị không hợp lệ.'})
        normalized[field] = value

    # Giữ nguyên overlay admin chọn (kể cả "none" khi có ảnh).
    return normalized


def _normalized_unique_list(values):
    return list(dict.fromkeys(values))


def normalize_path_prefix(prefix):
    prefix = prefix.strip()
    if (
        not prefix.startswith('/')
        or prefix.startswith('//')
        or '?' in prefix
        or '#' in prefix
        or len(prefix) > 500
    ):
        raise ValidationError('Prefix phải là application path tuyệt đối, không có query/hash.')
    if prefix != '/':
        prefix = prefix.rstrip('/')
    return prefix or '/'


def validate_cta_url(url):
    if not url:
        return ''
    if url.startswith('/') and not url.startswith('//'):
        return url
    parsed = urlsplit(url)
    if (
        parsed.scheme != 'https'
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValidationError('URL ngoài phải dùng HTTPS và không được chứa credential.')
    return url


def normalize_revision_data(data):
    normalized = dict(data)
    list_contracts = {
        'surfaces': set(AnnouncementRevision.Surface.values),
        'auth_audiences': set(AnnouncementRevision.Audience.values),
        'roles': set(User.Role.values),
    }
    for field, allowed in list_contracts.items():
        values = _normalized_unique_list(normalized.get(field, []))
        invalid = set(values) - allowed
        if invalid:
            raise ValidationError({field: f'Giá trị không hợp lệ: {", ".join(sorted(invalid))}.'})
        normalized[field] = values
    if not normalized['surfaces']:
        raise ValidationError({'surfaces': 'Chọn ít nhất một surface.'})
    if not normalized['auth_audiences']:
        raise ValidationError({'auth_audiences': 'Chọn ít nhất một audience.'})

    for field in ('include_path_prefixes', 'exclude_path_prefixes'):
        try:
            normalized[field] = _normalized_unique_list(
                normalize_path_prefix(value) for value in normalized.get(field, [])
            )
        except (AttributeError, ValidationError) as error:
            raise ValidationError({field: str(error)}) from error
    try:
        normalized['cta_url'] = validate_cta_url(normalized.get('cta_url', '').strip())
    except ValidationError as error:
        raise ValidationError({'cta_url': error.messages}) from error

    # Default visual fields when callers (tests/legacy) omit AN-V keys.
    normalized.setdefault('theme_mode', AnnouncementRevision.ThemeMode.KIND)
    normalized.setdefault('theme_preset', '')
    normalized.setdefault('color_accent', '')
    normalized.setdefault('color_bg_from', '')
    normalized.setdefault('color_bg_to', '')
    normalized.setdefault('color_fg', '')
    normalized.setdefault('background_image', '')
    normalized.setdefault('background_fit', AnnouncementRevision.BackgroundFit.COVER)
    normalized.setdefault('background_position', AnnouncementRevision.BackgroundPosition.CENTER)
    normalized.setdefault('background_overlay', AnnouncementRevision.BackgroundOverlay.NONE)
    normalized = normalize_theme_and_background(normalized)
    return normalized
