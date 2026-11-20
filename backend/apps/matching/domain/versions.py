"""Phiên bản bộ trích xuất và mô hình mã hóa đang dùng.

Vector chỉ so được với nhau khi cùng phiên bản mô hình; hồ sơ chỉ dùng lại được khi
cùng phiên bản trích xuất. Cả hai nằm trong khóa của `MatchDocument` và `MatchAnalysis`.
"""

from django.conf import settings

# Đổi khi quy tắc trích xuất đổi: hồ sơ và vector cũ không được dùng lại.
# Cấu trúc của hồ sơ: `services/extraction/profile.schema.json`.
EXTRACTOR_VERSION = 'extract-v3'
HASHING_MODEL_VERSION = 'hashing-v1'


def model_version():
    """Phiên bản mô hình đang cấu hình (đọc được mà không nạp mô hình)."""
    if settings.MATCHING_ENCODER_BACKEND == 'hashing':
        return HASHING_MODEL_VERSION
    return settings.MATCHING_MODEL_VERSION
