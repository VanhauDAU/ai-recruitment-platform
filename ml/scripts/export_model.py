"""Lưu một mô hình vào `ml/models/<tên>/<phiên bản>/` kèm `model_card.json` cho ml-worker.

ml-worker đọc mô hình từ thư mục này (mount `/models`), không tải từ Internet.
Bản zero-shot lấy `intfloat/multilingual-e5-base` từ cache Hugging Face trên máy:

    ml/.venv/bin/python ml/scripts/export_model.py

Sau đó đặt trong backend/.env:
    MATCHING_ENCODER_BACKEND=sentence_transformers
    MATCHING_MODEL_PATH=/models/multilingual-e5-base/zs-v1
    MATCHING_MODEL_VERSION=e5-base-zs-v1
rồi khởi động lại ml-worker và chạy `matching_backfill --inline`.
"""

import argparse
import json
import os
from datetime import date

from paths import MODELS_DIR

os.environ.setdefault('HF_HUB_OFFLINE', '1')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--source', default='intfloat/multilingual-e5-base')
    parser.add_argument('--name', default='multilingual-e5-base')
    parser.add_argument('--version', default='zs-v1')
    parser.add_argument('--model-version', default='e5-base-zs-v1', help='Giá trị MATCHING_MODEL_VERSION.')
    options = parser.parse_args()

    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(options.source, device='cpu')
    target = MODELS_DIR / options.name / options.version
    target.mkdir(parents=True, exist_ok=True)
    model.save(str(target))
    card = {
        'model_version': options.model_version,
        'base_model': options.source,
        'training': 'zero-shot (chưa fine-tune)',
        'dimensions': model.get_sentence_embedding_dimension(),
        'max_seq_length': model.max_seq_length,
        'prefixes': {'job': 'query: ', 'cv': 'passage: '},
        'exported_on': date.today().isoformat(),
    }
    (target / 'model_card.json').write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Đã lưu {target} ({card["dimensions"]} chiều).')


if __name__ == '__main__':
    main()
