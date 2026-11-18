"""Bước 2 của đối sánh: câu → vector 768 chiều.

Hai bộ mã hóa, chọn bằng `MATCHING_ENCODER_BACKEND`:

- `sentence_transformers`: mô hình E5 (`MATCHING_MODEL_PATH`), chỉ chạy trong
  service `ml-worker` (image có torch). Theo quy ước của E5, câu của tin mang
  tiền tố `query: `, câu của CV mang `passage: `.
- `hashing`: băm từ thành vector, tất định, không cần torch. Dùng cho test và
  CI; không dùng để chấm thật.

Vector luôn được chuẩn hóa độ dài 1, nên tích vô hướng là cosine.
"""

import hashlib
import re
import unicodedata
from functools import lru_cache

import numpy as np
from django.conf import settings

from ..models import EMBEDDING_DIMENSIONS

HASHING_MODEL_VERSION = 'hashing-v1'
_WORD = re.compile(r'[^\W_]+')


def model_version():
    """Phiên bản mô hình đang cấu hình; là một phần của khóa cache (đọc được mà không nạp mô hình)."""
    if settings.MATCHING_ENCODER_BACKEND == 'hashing':
        return HASHING_MODEL_VERSION
    return settings.MATCHING_MODEL_VERSION


def _normalize(matrix):
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.where(norms == 0, 1, norms)


class HashingEncoder:
    """Mỗi từ (và cặp từ liền nhau) cộng ±1 vào một chiều chọn bằng SHA-1."""

    version = HASHING_MODEL_VERSION

    def _vector(self, text):
        words = _WORD.findall(unicodedata.normalize('NFC', text).casefold())
        vector = np.zeros(EMBEDDING_DIMENSIONS, dtype=np.float32)
        for token in words + [f'{a}_{b}' for a, b in zip(words, words[1:], strict=False)]:
            digest = hashlib.sha1(token.encode()).digest()
            index = int.from_bytes(digest[:4], 'big') % EMBEDDING_DIMENSIONS
            vector[index] += 1.0 if digest[4] % 2 else -1.0
        return vector

    def encode(self, texts, *, kind):
        if not texts:
            return np.zeros((0, EMBEDDING_DIMENSIONS), dtype=np.float32)
        return _normalize(np.stack([self._vector(text) for text in texts]))


class SentenceTransformerEncoder:
    """Mô hình E5 nạp một lần cho mỗi tiến trình worker (import torch trễ)."""

    PREFIXES = {'query': 'query: ', 'passage': 'passage: '}
    MAX_SEQ_LENGTH = 512
    BATCH_SIZE = 16

    def __init__(self, path, version):
        from sentence_transformers import SentenceTransformer

        self.version = version
        self._model = SentenceTransformer(path, device='cpu')
        self._model.max_seq_length = self.MAX_SEQ_LENGTH

    def encode(self, texts, *, kind):
        if not texts:
            return np.zeros((0, EMBEDDING_DIMENSIONS), dtype=np.float32)
        prefix = self.PREFIXES[kind]
        vectors = self._model.encode(
            [prefix + text for text in texts],
            batch_size=self.BATCH_SIZE,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return np.asarray(vectors, dtype=np.float32)


@lru_cache(maxsize=1)
def get_encoder():
    if settings.MATCHING_ENCODER_BACKEND == 'hashing':
        return HashingEncoder()
    return SentenceTransformerEncoder(settings.MATCHING_MODEL_PATH, settings.MATCHING_MODEL_VERSION)
