"""Kiểm một hồ sơ theo `services/extraction/profile.schema.json` (chuẩn đầu vào của bước chấm)."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from ..services import extraction

SCHEMA = json.loads(
    (Path(extraction.__file__).parent / 'profile.schema.json').read_text(encoding='utf-8')
)
_VALIDATOR = Draft202012Validator(SCHEMA)


def schema_errors(profile):
    """Danh sách lỗi (đường dẫn: thông báo); rỗng nếu hồ sơ đúng chuẩn."""
    return [
        f'{"/".join(str(part) for part in error.path)}: {error.message}'
        for error in _VALIDATOR.iter_errors(profile)
    ]
