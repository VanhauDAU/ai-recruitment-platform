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

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Calibration:
    document: tuple  # (low, high) cho cosine toàn văn
    title: tuple  # (low, high) cho cosine chức danh
    skill: float  # ngưỡng nhận một kỹ năng viết khác tên (τ_skill)
    requirement_met: float  # câu CV đáp ứng một yêu cầu
    requirement_partial: float  # câu CV đáp ứng một phần


# Mốc theo phiên bản mô hình, đo bằng `ml/scripts/calibrate.py`; chỉnh lại trên
# tập validation do người chấm ở tuần 6. Mô hình chưa đo dùng mốc của e5-base.
CALIBRATIONS = {
    'hashing-v1': Calibration(
        document=(0.05, 0.6),
        title=(0.0, 0.7),
        skill=0.6,
        requirement_met=0.45,
        requirement_partial=0.25,
    ),
    'e5-base-zs-v1': Calibration(
        document=(0.817, 0.889),
        title=(0.807, 0.918),
        skill=0.846,
        requirement_met=0.855,
        requirement_partial=0.838,
    ),
}
DEFAULT_CALIBRATION = CALIBRATIONS['e5-base-zs-v1']


def calibration_for(model_version):
    return CALIBRATIONS.get(model_version, DEFAULT_CALIBRATION)


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


def to_score(similarity, marks):
    low, high = marks
    return float(np.clip((similarity - low) / (high - low), 0.0, 1.0) * 100)


def requirement_status(similarity, calibration):
    if similarity >= calibration.requirement_met:
        return 'met'
    if similarity >= calibration.requirement_partial:
        return 'partial'
    return 'unmet'
