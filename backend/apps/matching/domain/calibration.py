"""Mốc quy đổi cosine thành điểm 0–100, theo từng phiên bản mô hình.

Cosine của E5 dồn trong một khoảng hẹp, nên mỗi phép so được hiệu chuẩn tuyến tính
giữa hai mốc: `low` (trung vị cặp khác ngành) → 0 điểm, `high` (phân vị 90 cặp khớp
mạnh) → 100 điểm. Mốc đo bằng `ml/scripts/calibrate.py`.
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
    # Có nhận kỹ năng "viết khác tên" theo τ_skill không. Mặc định tắt: chỉ bật cho
    # mô hình đã đo được là ngưỡng này đủ chính xác.
    semantic_skills: bool = False


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
        # `semantic_skills` để tắt: với mô hình chưa fine-tune, ngưỡng 0,846 nhận nhầm
        # phần lớn (trên validation, cặp khác ngành có 23/42 lượt khớp kỹ năng là
        # khớp kiểu này; cặp nhãn 3–4 chỉ 1/53). Số đo ở `ml/reports/eval_validation.md`.
        skill=0.846,
        requirement_met=0.855,
        requirement_partial=0.838,
    ),
}
DEFAULT_CALIBRATION = CALIBRATIONS['e5-base-zs-v1']


def calibration_for(model_version):
    return CALIBRATIONS.get(model_version, DEFAULT_CALIBRATION)


def to_score(similarity, marks):
    low, high = marks
    return float(np.clip((similarity - low) / (high - low), 0.0, 1.0) * 100)
