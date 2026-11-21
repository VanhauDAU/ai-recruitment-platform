"""Định nghĩa thuần của đối sánh CV–tin mà cả services lẫn selectors cùng dùng.

`versions`: phiên bản bộ trích xuất và mô hình (một phần của khóa cache và của điều
kiện "vector so được với nhau"). `calibration`: mốc quy đổi cosine thành điểm 0–100
của từng mô hình.
"""

from .calibration import CALIBRATIONS, DEFAULT_CALIBRATION, Calibration, calibration_for, to_score
from .versions import EXTRACTOR_VERSION, HASHING_MODEL_VERSION, model_version

__all__ = [
    'CALIBRATIONS',
    'DEFAULT_CALIBRATION',
    'EXTRACTOR_VERSION',
    'HASHING_MODEL_VERSION',
    'Calibration',
    'calibration_for',
    'model_version',
    'to_score',
]
