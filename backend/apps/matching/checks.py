"""Kiểm tra cấu hình mô hình đối sánh lúc khởi động.

Mỗi mô hình có mốc quy đổi riêng (`domain/calibration.py`). Trỏ cấu hình sang một mô
hình chưa có mốc thì mọi điểm đều sai mà không có lỗi nào hiện ra, nên việc này phải bị
chặn ngay khi chạy `manage.py check` hoặc `migrate`, trước khi dịch vụ nhận yêu cầu.
"""

from django.conf import settings
from django.core.checks import Error, register

from .domain import CALIBRATIONS, RERANKER_THRESHOLDS, model_version, reranker_version

RERANKER_BACKENDS = ('none', 'cross_encoder', 'hashing')


def configuration_errors():
    errors = []
    if model_version() not in CALIBRATIONS:
        errors.append(
            f'MATCHING_MODEL_VERSION={model_version()!r} chưa có mốc quy đổi trong CALIBRATIONS.'
        )
    if settings.MATCHING_RERANKER_BACKEND not in RERANKER_BACKENDS:
        errors.append(
            f'MATCHING_RERANKER_BACKEND={settings.MATCHING_RERANKER_BACKEND!r} không hợp lệ; '
            f'chọn một trong {", ".join(RERANKER_BACKENDS)}.'
        )
    elif reranker_version() is not None and reranker_version() not in RERANKER_THRESHOLDS:
        errors.append(
            f'MATCHING_RERANKER_VERSION={reranker_version()!r} chưa có ngưỡng trong '
            'RERANKER_THRESHOLDS.'
        )
    return errors


@register()
def matching_model_configuration_check(app_configs, **kwargs):
    del app_configs, kwargs
    return [
        Error(message, id=f'matching.E{index:03d}')
        for index, message in enumerate(configuration_errors(), 1)
    ]
