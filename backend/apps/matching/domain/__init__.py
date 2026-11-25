"""Định nghĩa thuần của đối sánh CV–tin mà cả services lẫn selectors cùng dùng.

`features`: khóa cấu hình bật/tắt từng chỗ dùng. `profile_view`: trường của hồ sơ trích xuất được phép hiển thị. `versions`: phiên bản bộ trích xuất và mô hình (một phần của khóa cache và của điều
kiện "vector so được với nhau"). `calibration`: mốc quy đổi cosine thành điểm 0–100
của từng mô hình.
"""

from .calibration import CALIBRATIONS, DEFAULT_CALIBRATION, Calibration, calibration_for, to_score
from .features import (
    APPLICATION_RANKING_FLAG,
    CANDIDATE_FIT_FLAG,
    CANDIDATE_SEARCH_FLAG,
    FEATURE_FLAGS,
    SEMANTIC_RECOMMENDATION_FLAG,
)
from .profile_view import OWNER, RECRUITER_SEARCH, public_cv_profile, redact_name, search_card
from .versions import EXTRACTOR_VERSION, HASHING_MODEL_VERSION, SCORING_VERSION, model_version

__all__ = [
    'CANDIDATE_SEARCH_FLAG',
    'OWNER',
    'RECRUITER_SEARCH',
    'public_cv_profile',
    'redact_name',
    'search_card',
    'APPLICATION_RANKING_FLAG',
    'CANDIDATE_FIT_FLAG',
    'FEATURE_FLAGS',
    'SEMANTIC_RECOMMENDATION_FLAG',
    'CALIBRATIONS',
    'DEFAULT_CALIBRATION',
    'EXTRACTOR_VERSION',
    'HASHING_MODEL_VERSION',
    'SCORING_VERSION',
    'Calibration',
    'calibration_for',
    'model_version',
    'to_score',
]
