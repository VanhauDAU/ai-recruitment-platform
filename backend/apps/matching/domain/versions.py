"""Phiên bản bộ trích xuất, mô hình mã hóa và công thức chấm đang dùng.

Vector chỉ so được với nhau khi cùng phiên bản mô hình; hồ sơ chỉ dùng lại được khi
cùng phiên bản trích xuất. Cả hai nằm trong khóa của `MatchDocument` và `MatchAnalysis`.
"""

from django.conf import settings

# Đổi khi quy tắc trích xuất đổi: hồ sơ và vector cũ không được dùng lại.
# Cấu trúc của hồ sơ: `services/extraction/profile.schema.json`.
EXTRACTOR_VERSION = 'extract-v4'
HASHING_MODEL_VERSION = 'hashing-v1'
HASHING_RERANKER_VERSION = 'hashing-ce-v1'
# Đổi khi công thức chấm đổi (`services/scoring/`): kết quả cũ không được dùng lại.
SCORING_VERSION = 'hybrid-v3'


def reranker_version():
    """Phiên bản cross-encoder đang cấu hình, hoặc None khi không dùng (không nạp mô hình)."""
    backend = settings.MATCHING_RERANKER_BACKEND
    if backend == 'none':
        return None
    return HASHING_RERANKER_VERSION if backend == 'hashing' else settings.MATCHING_RERANKER_VERSION


def scoring_cache_version():
    """Phiên bản công thức ghi vào `MatchAnalysis`: công thức kèm cross-encoder nếu có.

    Cùng một công thức cho điểm khác nhau khi có và không có cross-encoder, hoặc khi đổi
    cross-encoder, nên phiên bản của nó là một phần của khóa cache.
    """
    reranker = reranker_version()
    return f'{SCORING_VERSION}+{reranker}' if reranker else SCORING_VERSION


def model_version():
    """Phiên bản mô hình đang cấu hình (đọc được mà không nạp mô hình)."""
    if settings.MATCHING_ENCODER_BACKEND == 'hashing':
        return HASHING_MODEL_VERSION
    return settings.MATCHING_MODEL_VERSION
