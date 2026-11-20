"""Site settings: cached public values and the admin bulk-update workflow."""

import math
import re
from dataclasses import dataclass, field

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator, validate_email
from django.db import transaction

# Import module hẹp: gói accounts.services đọc cấu hình qua sitecontent.selectors.
from apps.accounts.services.admin_audit import record_admin_action
from common.storage.media import (
    delete_local_media_url,
    media_storage_path,
    normalise_media_value,
    save_image_upload,
)

from ..models import SiteSetting
from .cache_keys import PUBLIC_SETTINGS_CACHE_KEY

_HEX_COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')

# Setting nào cần giới hạn kích thước pixel lúc upload (tránh admin upload ảnh
# gốc to làm icon nhỏ, nặng trang mà không hay biết — vd favicon).
UPLOAD_MAX_DIMENSIONS = {
    'brand_favicon_url': (256, 256),
    'footer_logo_url': (1600, 600),
    'footer_qr_code_url': (1200, 1200),
}


def public_setting_values():
    """``{key: (value, is_image)}`` of every public setting, cached for one hour.

    Cache storage keys, không cache URL tuyệt đối. Nhờ vậy thay domain/CDN không
    làm database hay cache giữ lại localhost/domain cũ. Receiver của SiteSetting
    xóa cache sau commit khi admin sửa.
    """
    data = cache.get(PUBLIC_SETTINGS_CACHE_KEY)
    if data is None:
        data = {
            s.key: (s.value, s.value_type == SiteSetting.ValueType.IMAGE)
            for s in SiteSetting.objects.filter(is_public=True)
        }
        cache.set(PUBLIC_SETTINGS_CACHE_KEY, data, 60 * 60)
    return data


_STRING_TYPES = {'text', 'textarea', 'email', 'url', 'image'}


def _number_error(value, options):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return 'Giá trị phải là số hữu hạn.'
    if options.get('integer') and not isinstance(value, int):
        return 'Giá trị phải là số nguyên.'
    minimum, maximum = options.get('min'), options.get('max')
    if isinstance(minimum, (int, float)) and value < minimum:
        return f'Giá trị nhỏ nhất là {minimum}.'
    if isinstance(maximum, (int, float)) and value > maximum:
        return f'Giá trị lớn nhất là {maximum}.'
    return None


def _is_http_url(value):
    try:
        URLValidator(schemes=['http', 'https'])(value)
    except DjangoValidationError:
        return False
    return True


def _string_error(value_type, value, options):
    if not isinstance(value, str):
        return 'Giá trị phải là chuỗi.'
    max_length = options.get('max_length')
    if isinstance(max_length, int) and len(value) > max_length:
        return f'Tối đa {max_length} ký tự.'
    if not value.strip():
        return None
    if value_type == 'url' and not (value.startswith('/') or _is_http_url(value)):
        return 'Giá trị phải là URL http(s) hoặc đường dẫn bắt đầu bằng "/".'
    if value_type == 'email':
        try:
            validate_email(value)
        except DjangoValidationError:
            return 'Email không hợp lệ.'
    return None


def _json_error(value, options):
    """``options.schema``: ``{"item": "string"}`` or ``{"item": "object", "fields", "required"}``."""
    schema = options.get('schema')
    if not isinstance(schema, dict):
        return None
    if not isinstance(value, list):
        return 'Giá trị phải là danh sách.'
    if schema.get('item') == 'string':
        if not all(isinstance(item, str) and item.strip() for item in value):
            return 'Mỗi phần tử phải là chuỗi không rỗng.'
        return None
    fields = set(schema.get('fields', []))
    required = schema.get('required', [])
    for index, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            return f'Dòng {index} phải là object.'
        unknown = set(item) - fields
        if unknown:
            return f'Dòng {index} có trường không hỗ trợ: {", ".join(sorted(unknown))}.'
        if not all(isinstance(item.get(name), str) and item[name].strip() for name in required):
            return f'Dòng {index} thiếu: {", ".join(required)}.'
    return None


def _validate_value(setting, value):
    """Kiểm tra value theo value_type + options; trả về (value đã chuẩn hoá, lỗi hoặc None)."""
    vt = SiteSetting.ValueType
    options = setting.resolved_options()
    if setting.value_type == vt.BOOLEAN:
        error = None if isinstance(value, bool) else 'Giá trị phải là true/false.'
    elif setting.value_type == vt.NUMBER:
        error = _number_error(value, options)
    elif setting.value_type == vt.COLOR:
        valid = isinstance(value, str) and _HEX_COLOR.match(value)
        error = None if valid else 'Giá trị phải là mã màu hex, vd: #00b14f.'
    elif setting.value_type == vt.SELECT:
        choices = [choice.get('value') for choice in options.get('choices', [])]
        error = None if value in choices else f'Giá trị phải thuộc: {", ".join(map(str, choices))}.'
    elif setting.value_type == vt.MULTISELECT:
        choices = [choice.get('value') for choice in options.get('choices', [])]
        valid = isinstance(value, list) and len(set(value)) == len(value)
        valid = valid and all(item in choices for item in value)
        error = None if valid else f'Mỗi lựa chọn phải thuộc: {", ".join(map(str, choices))}.'
    elif setting.value_type == vt.JSON:
        error = _json_error(value, options)
    elif setting.value_type in _STRING_TYPES:
        error = _string_error(setting.value_type, value, options)
    else:
        error = None
    return (None, error) if error else (value, None)


@dataclass
class SiteSettingsUpdate:
    """Kết quả cập nhật hàng loạt; ``image_keys`` là key ảnh cần trả URL hiển thị."""

    updated: list = field(default_factory=list)
    errors: dict = field(default_factory=dict)
    values: dict = field(default_factory=dict)
    image_keys: list = field(default_factory=list)


def _audit(actor, setting, before):
    record_admin_action(
        actor=actor,
        action='site_setting_update',
        target_type='site_setting',
        target_public_id=setting.key,
        payload={'before': before, 'after': setting.value},
    )


def _record_change(result, setting):
    result.updated.append(setting.key)
    result.values[setting.key] = setting.value
    if setting.value_type == SiteSetting.ValueType.IMAGE:
        result.image_keys.append(setting.key)


def _delete_after_commit(old_value):
    # Chỉ xoá file cũ sau khi transaction đã commit. URL ngoài hệ thống sẽ
    # không bao giờ bị động tới.
    transaction.on_commit(lambda: delete_local_media_url(old_value))


def update_site_settings(*, actor, values, image_uploads):
    """Apply ``values`` and uploaded images per key; unknown/invalid keys go to ``errors``.

    Một key lỗi không chặn key khác. File mới đã lưu bị dọn nếu transaction lỗi.
    """
    keys = set(values) | set(image_uploads)
    settings_map = {s.key: s for s in SiteSetting.objects.filter(key__in=keys)}
    result = SiteSettingsUpdate()
    saved_paths = []
    try:
        with transaction.atomic():
            for key, value in values.items():
                if key in image_uploads:
                    continue
                setting = settings_map.get(key)
                if setting is None:
                    result.errors[key] = 'Không tồn tại key này.'
                    continue
                value, error = _validate_value(setting, value)
                if error:
                    result.errors[key] = error
                    continue
                if setting.value_type == SiteSetting.ValueType.IMAGE:
                    value = normalise_media_value(value)
                if setting.value != value:
                    old_value = setting.value
                    setting.value = value
                    setting.save(update_fields=['value', 'updated_at'])
                    _audit(actor, setting, old_value)
                    if media_storage_path(old_value) != media_storage_path(value):
                        _delete_after_commit(old_value)
                _record_change(result, setting)

            for key, upload in image_uploads.items():
                setting = settings_map.get(key)
                if setting is None:
                    result.errors[key] = 'Không tồn tại key này.'
                    continue
                if setting.value_type != SiteSetting.ValueType.IMAGE:
                    result.errors[key] = 'Cấu hình này không phải kiểu ảnh.'
                    continue

                saved = save_image_upload(
                    upload,
                    'site/settings',
                    max_dimensions=UPLOAD_MAX_DIMENSIONS.get(key),
                )
                saved_paths.append(saved['path'])
                old_value = setting.value
                setting.value = saved['path']
                setting.save(update_fields=['value', 'updated_at'])
                _audit(actor, setting, old_value)
                if media_storage_path(old_value) != saved['path']:
                    _delete_after_commit(old_value)
                _record_change(result, setting)
    except Exception:
        for path in saved_paths:
            delete_local_media_url(path)
        raise
    return result
