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
    # Bi-encoder fine-tune lượt đầu (27/11). Mốc toàn văn và chức danh đo trên 321 cặp có
    # nhãn của tập hiệu chỉnh (`ml/reports/calibration_set_e5-base-ft-v1.md`): sau fine-tune
    # cosine trải từ khoảng 0,13 tới 0,81 thay vì dồn trong 0,82–0,89. Ba ngưỡng theo câu
    # (kỹ năng, yêu cầu) mới là tạm tính theo vị trí trong khoảng toàn văn, chưa đo riêng;
    # trạng thái từng yêu cầu sẽ do cross-encoder quyết định.
    'e5-base-ft-v1': Calibration(
        document=(0.132, 0.809),
        title=(0.338, 0.840),
        skill=0.80,
        requirement_met=0.64,
        requirement_partial=0.47,
    ),
    # Nội suy trọng số 30% mô hình gốc + 70% `e5-base-ft-v1` (`ml/scripts/interpolate_model.py`).
    # Mốc chọn bằng `ml/scripts/calibrate_scale.py` trên tập hiệu chỉnh: `low` là trung vị
    # cosine của cặp nhãn 0, `high` là phân vị 90 của cặp nhãn 3–4. Ba ngưỡng theo câu là
    # tạm tính như ở `e5-base-ft-v1`.
    'e5-base-wise-v1': Calibration(
        document=(0.204, 0.772),
        title=(0.530, 0.851),
        skill=0.80,
        requirement_met=0.63,
        requirement_partial=0.49,
    ),
}
DEFAULT_CALIBRATION = CALIBRATIONS['e5-base-zs-v1']


# Ngưỡng xác suất của cross-encoder: (đạt, có liên quan). `req-ce-v1` chọn trên 215 cặp
# yêu cầu–câu CV thật của tập hiệu chỉnh: ngưỡng "đạt" thấp nhất còn giữ precision từ 0,85
# (`ml/reports/reranker_eval.md`; trên 143 cặp validation precision là 0,947).
RERANKER_THRESHOLDS = {
    'hashing-ce-v1': (0.6, 0.3),
    'req-ce-v1': (0.853, 0.063),
}


def reranker_thresholds(version):
    """Ngưỡng của một cross-encoder; phiên bản chưa đo thì báo lỗi thay vì đoán."""
    return RERANKER_THRESHOLDS[version]


def calibration_for(model_version):
    return CALIBRATIONS.get(model_version, DEFAULT_CALIBRATION)


def to_score(similarity, marks):
    low, high = marks
    return float(np.clip((similarity - low) / (high - low), 0.0, 1.0) * 100)
