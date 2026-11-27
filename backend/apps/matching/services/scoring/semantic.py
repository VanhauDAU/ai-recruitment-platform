"""Độ tương đồng ngữ nghĩa: cosine giữa vector, hiệu chuẩn về 0–100, MaxSim cho bằng chứng.

Mức liên quan của CV với tin dựa trên hai phép so (đo ở
`ml/reports/calibration_e5-base-zs-v1.md`, nhãn yếu):
- toàn văn tin ↔ toàn văn CV (AUC 0,899);
- tên vị trí trong tiêu đề tin ↔ headline/chức danh gần nhất của CV (AUC 0,935).

So từng câu yêu cầu với câu CV gần nhất (MaxSim) gần như không phân biệt được
cặp khớp và cặp khác ngành ở chế độ zero-shot (AUC 0,588), nên MaxSim chỉ dùng
để chỉ ra câu bằng chứng cho từng yêu cầu, với ngưỡng chặt.

Cosine của E5 dồn trong một khoảng hẹp, nên mỗi phép so được hiệu chuẩn tuyến
tính giữa hai mốc: `low` (trung vị cặp khác ngành) → 0 điểm, `high` (phân vị 90
cặp khớp mạnh) → 100 điểm.
"""

import numpy as np

from ...domain import CALIBRATIONS, Calibration, calibration_for, to_score

__all__ = [
    'CALIBRATIONS',
    'Calibration',
    'best_matches',
    'calibration_for',
    'cosine',
    'requirement_status',
    'to_score',
]


def cosine(left, right):
    return round(float(np.dot(left, right)), 4)


def best_matches(queries, passages):
    """[(chỉ số câu CV tốt nhất, cosine)] cho từng câu của tin; rỗng nếu CV không có câu."""
    if not len(queries) or not len(passages):
        return [(None, 0.0)] * len(queries)
    similarities = queries @ passages.T
    best = similarities.argmax(axis=1)
    return [
        (int(index), round(float(similarities[row, index]), 4)) for row, index in enumerate(best)
    ]


def requirement_status(similarity, calibration):
    if similarity >= calibration.requirement_met:
        return 'met'
    if similarity >= calibration.requirement_partial:
        return 'partial'
    return 'unmet'
