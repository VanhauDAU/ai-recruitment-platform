"""Mốc quy đổi cosine → điểm của một bi-encoder, đo trên tập hiệu chỉnh có nhãn.

    ml/.venv/bin/python ml/scripts/calibrate_labeled.py --model-dir multilingual-e5-base/zs-v1 --version e5-base-zs-v1
    ml/.venv/bin/python ml/scripts/calibrate_labeled.py --model-dir multilingual-e5-base/ft-v1 --version e5-base-ft-v1

Khác `calibrate.py` (nhãn yếu trên CV của tập vàng): ở đây dùng 321 cặp của tập hiệu
chỉnh (`ml/labeling/calibration_labels.json`), nhãn 0–4 theo rubric, và 14 tin cùng CV
của tập này không có trong dữ liệu huấn luyện. Văn bản của tin và CV là văn bản sản
phẩm đưa vào mô hình (tin từ `profiles/jd.jsonl`, CV qua `matching_export_dataset
texts`), nên cần Docker đang bật.

Hai phép so, như `scoring.engine._relevance`:
- toàn văn: vector toàn văn tin (`query: `) với toàn văn CV (`passage: `);
- chức danh: tên vị trí của tin với chức danh của CV.

Mốc theo cùng quy ước với `domain/calibration.py`: `low` là trung vị cosine của cặp
nhãn 0 (0 điểm), `high` là phân vị 90 của cặp nhãn 3–4 (100 điểm). Báo cáo kèm cosine
theo nhãn, Spearman với nhãn và AUC tách nhãn 3–4 khỏi nhãn 0–1, để so hai mô hình trên
dữ liệu chưa từng dùng để huấn luyện.

Kết quả: `ml/reports/calibration_set_<phiên bản>.md` và dòng `Calibration(...)` để chép
vào `CALIBRATIONS`.
"""

import argparse
import json
import os

import numpy as np
from build_train_pairs import DROPPED_CV_SECTIONS, export_texts, job_texts
from paths import LABELING_DIR, LABELS_DIR, MODELS_DIR, REPORTS_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST
from scipy.stats import spearmanr
from sklearn.metrics import roc_auc_score


def number(value, digits=3):
    return f'{value:.{digits}f}'.replace('.', ',')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model-dir', required=True, help='Thư mục trong ml/models.')
    parser.add_argument('--version', required=True, help='Phiên bản mô hình, như e5-base-ft-v1.')
    options = parser.parse_args()

    labels = json.loads((LABELING_DIR / 'calibration_labels.json').read_text(encoding='utf-8'))['pairs']
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    codes = sorted({row['cv'] for row in labels})
    items = [
        {'id': code, 'kind': 'cv', 'language': manifest[code]['language'],
         'data': {key: value for key, value in json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8')).items() if key not in DROPPED_CV_SECTIONS}}
        for code in codes
    ]  # fmt: skip
    cvs, jobs = export_texts(items), job_texts()

    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
    os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(str(MODELS_DIR / options.model_dir), device='mps')
    model.max_seq_length = 512

    def encode(texts, prefix):
        unique = sorted(set(texts))
        vectors = model.encode([prefix + text for text in unique], batch_size=8, normalize_embeddings=True)
        return dict(zip(unique, vectors, strict=True))

    rows = [row for row in labels if row['cv'] in cvs and row['jd'] in jobs]
    job_vectors = encode([jobs[row['jd']]['text'] for row in rows], 'query: ')
    cv_vectors = encode([cvs[row['cv']]['text'] for row in rows], 'passage: ')
    job_titles = encode([jobs[row['jd']]['title'] for row in rows if jobs[row['jd']]['title']], 'query: ')
    cv_titles = encode([cvs[row['cv']]['title'] for row in rows if cvs[row['cv']].get('title')], 'passage: ')

    gold = np.array([row['label'] for row in rows])
    document = np.array([float(job_vectors[jobs[row['jd']]['text']] @ cv_vectors[cvs[row['cv']]['text']]) for row in rows])
    title = np.array([
        float(job_titles[jobs[row['jd']]['title']] @ cv_titles[cvs[row['cv']]['title']])
        if jobs[row['jd']]['title'] and cvs[row['cv']].get('title') else np.nan
        for row in rows
    ])  # fmt: skip

    def marks(values):
        known = ~np.isnan(values)
        return float(np.median(values[known & (gold == 0)])), float(np.percentile(values[known & (gold >= 3)], 90))

    def quality(values):
        known = ~np.isnan(values)
        extreme = known & ((gold >= 3) | (gold <= 1))
        return (
            float(spearmanr(values[known], gold[known]).statistic),
            float(roc_auc_score(gold[extreme] >= 3, values[extreme])),
        )

    lines = [
        f'# Hiệu chỉnh `{options.version}` trên tập hiệu chỉnh có nhãn',
        '',
        f'{len(rows)} cặp của {len({row["jd"] for row in rows})} tin không có trong dữ liệu huấn luyện; nhãn 0–4 theo rubric.',
        'Tạo bằng `ml/scripts/calibrate_labeled.py`.',
        '',
        '| Phép so | Spearman với nhãn | AUC (nhãn 3–4 so với 0–1) | `low` (trung vị nhãn 0) | `high` (phân vị 90 nhãn 3–4) |',
        '| --- | ---: | ---: | ---: | ---: |',
    ]
    found = {}
    for name, values in (('Toàn văn', document), ('Chức danh', title)):
        rho, auc = quality(values)
        found[name] = marks(values)
        lines.append(f'| {name} | {number(rho)} | {number(auc)} | {number(found[name][0])} | {number(found[name][1])} |')
    lines += ['', '## Cosine trung vị theo nhãn', '', '| Phép so | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |', '| --- | ---: | ---: | ---: | ---: | ---: |']
    for name, values in (('Toàn văn', document), ('Chức danh', title)):
        medians = [np.nanmedian(values[gold == label]) for label in range(5)]
        lines.append(f'| {name} | ' + ' | '.join(number(float(value)) for value in medians) + ' |')
    entry = (
        f"'{options.version}': Calibration(document=({found['Toàn văn'][0]:.3f}, {found['Toàn văn'][1]:.3f}), "
        f"title=({found['Chức danh'][0]:.3f}, {found['Chức danh'][1]:.3f}), ...)"
    )
    lines += ['', 'Mục cho `CALIBRATIONS` (`backend/apps/matching/domain/calibration.py`):', '', f'    {entry}']
    REPORTS_DIR.joinpath(f'calibration_set_{options.version}.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    LABELS_DIR.joinpath(f'calibration_cosine_{options.version}.json').write_text(
        json.dumps([{'jd': row['jd'], 'cv': row['cv'], 'label': row['label'], 'document': float(d), 'title': None if np.isnan(t) else float(t)} for row, d, t in zip(rows, document, title, strict=True)]),
        encoding='utf-8',
    )  # fmt: skip
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
