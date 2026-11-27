"""Nội suy trọng số giữa bi-encoder gốc và bản fine-tune (WiSE-FT).

    ml/.venv/bin/python ml/scripts/interpolate_model.py --alpha 0.7

Trọng số mới = (1 − α) × gốc + α × fine-tune, cho mọi tham số. Fine-tune trên dữ liệu
hẹp (CV tổng hợp của một mô hình sinh, 56 tin) làm mô hình giỏi hơn ở đúng phân bố đó
nhưng dễ mất bớt hiểu biết chung của mô hình gốc; lấy một điểm giữa hai bộ trọng số
thường cho mô hình vừa giữ được phần đã học vừa bền hơn với dữ liệu khác phân bố
(Wortsman và cộng sự, "Robust fine-tuning of zero-shot models", 2022). Không cần huấn
luyện thêm.

α chọn trên tập hiệu chỉnh có nhãn (`calibrate_labeled.py`), không chọn trên tập vàng.
Đo ngày 27/11 với `ft-v1` (Spearman cosine toàn văn với nhãn): α = 0 (gốc) 0,685;
0,3: 0,770; 0,5: 0,798; 0,7: 0,808; 0,85: 0,788; 1 (fine-tune) 0,743.

Kết quả: `ml/models/<tên>/<phiên bản>/` kèm `model_card.json`.
"""

import argparse
import json
import os
import subprocess
from datetime import date

os.environ.setdefault('HF_HUB_OFFLINE', '1')

from paths import MODELS_DIR, REPO_ROOT  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--name', default='multilingual-e5-base')
    parser.add_argument('--base', default='zs-v1')
    parser.add_argument('--tuned', default='ft-v1')
    parser.add_argument('--alpha', type=float, required=True, help='Phần của bản fine-tune, từ 0 đến 1.')
    parser.add_argument('--version', default='wise-v1')
    options = parser.parse_args()

    from sentence_transformers import SentenceTransformer

    folder = MODELS_DIR / options.name
    model = SentenceTransformer(str(folder / options.base), device='cpu')
    tuned = SentenceTransformer(str(folder / options.tuned), device='cpu').state_dict()
    base = model.state_dict()
    model.load_state_dict({
        key: (1 - options.alpha) * value + options.alpha * tuned[key] if value.dtype.is_floating_point else tuned[key]
        for key, value in base.items()
    })  # fmt: skip
    model.max_seq_length = 512
    target = folder / options.version
    target.mkdir(parents=True, exist_ok=True)
    model.save(str(target))
    short = {'multilingual-e5-base': 'e5-base'}.get(options.name, options.name)
    tuned_card = json.loads((folder / options.tuned / 'model_card.json').read_text(encoding='utf-8'))
    commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=REPO_ROOT).stdout.strip()  # fmt: skip
    card = {
        'model_version': f'{short}-{options.version}',
        'base_model': tuned_card.get('base_model'),
        'training': f'nội suy trọng số (WiSE-FT): (1 − {options.alpha}) × {options.base} + {options.alpha} × {options.tuned}',
        'alpha': options.alpha,
        'parents': {'base': options.base, 'tuned': tuned_card.get('model_version')},
        'data': tuned_card.get('data'),
        'dimensions': model.get_sentence_embedding_dimension(),
        'max_seq_length': model.max_seq_length,
        'prefixes': tuned_card.get('prefixes'),
        'git_commit': commit,
        'exported_on': date.today().isoformat(),
    }
    (target / 'model_card.json').write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(card, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
