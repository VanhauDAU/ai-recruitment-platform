"""Cross-encoder phán một câu CV có đáp ứng một câu yêu cầu của tin hay không.

Bi-encoder (`encoder.py`) mã hóa từng câu riêng rồi so vector: nhanh, dùng để tìm câu
ứng viên, nhưng không đủ chính xác để kết luận "đạt". Cross-encoder đọc cùng lúc cả
hai câu và trả xác suất câu CV đáp ứng yêu cầu; chậm hơn nên chỉ chấm vài câu CV đứng
đầu của mỗi yêu cầu (`scoring/requirements.py`).

Chọn bằng `MATCHING_RERANKER_BACKEND`:

- `none` (mặc định): không có cross-encoder; công thức chấm như khi chưa có nó;
- `cross_encoder`: mô hình ở `MATCHING_RERANKER_PATH`, chỉ chạy trong `ml-worker`;
- `hashing`: tỷ lệ từ trùng nhau, tất định, không cần torch. Chỉ dùng cho test.

Ngưỡng "đạt" và "có liên quan" theo từng phiên bản nằm ở `domain/calibration.py`.
"""

import re
import unicodedata
from functools import lru_cache

import numpy as np
from django.conf import settings

from ..domain import HASHING_RERANKER_VERSION

__all__ = ['CrossEncoderReranker', 'HashingReranker', 'get_reranker']

_WORD = re.compile(r'[^\W_]+')


def _words(text):
    return set(_WORD.findall(unicodedata.normalize('NFC', text).casefold()))


class HashingReranker:
    """Xác suất giả: phần từ của câu yêu cầu có mặt trong câu CV."""

    version = HASHING_RERANKER_VERSION

    def score(self, pairs):
        scores = []
        for requirement, sentence in pairs:
            wanted = _words(requirement)
            scores.append(len(wanted & _words(sentence)) / len(wanted) if wanted else 0.0)
        return np.asarray(scores, dtype=np.float32)


class CrossEncoderReranker:
    """Mô hình nạp một lần cho mỗi tiến trình worker (import torch trễ)."""

    MAX_LENGTH = 160
    BATCH_SIZE = 16

    def __init__(self, path, version):
        import torch
        from sentence_transformers.cross_encoder import CrossEncoder

        self.version = version
        # Mô hình lưu đầu ra thô (logit); Sigmoid đổi thành xác suất như lúc huấn luyện.
        self._model = CrossEncoder(
            path,
            num_labels=1,
            max_length=self.MAX_LENGTH,
            device='cpu',
            activation_fn=torch.nn.Sigmoid(),
        )

    def score(self, pairs):
        if not pairs:
            return np.zeros(0, dtype=np.float32)
        scores = self._model.predict(list(pairs), batch_size=self.BATCH_SIZE)
        return np.asarray(scores, dtype=np.float32).reshape(-1)


@lru_cache(maxsize=1)
def get_reranker():
    """Cross-encoder đang cấu hình, hoặc None khi không dùng."""
    backend = settings.MATCHING_RERANKER_BACKEND
    if backend == 'none':
        return None
    if backend == 'hashing':
        return HashingReranker()
    return CrossEncoderReranker(settings.MATCHING_RERANKER_PATH, settings.MATCHING_RERANKER_VERSION)
