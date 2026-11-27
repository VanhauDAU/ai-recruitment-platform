"""Cặp (câu yêu cầu, câu CV) thật để đo cross-encoder và chọn ngưỡng.

    ml/.venv/bin/python ml/scripts/build_requirement_eval.py           # lấy cặp, ghi phiếu mù
    ml/.venv/bin/python ml/scripts/build_requirement_eval.py merge     # gộp hai lượt nhãn

Dữ liệu huấn luyện của cross-encoder phần lớn là câu do máy viết theo từng yêu cầu. Để
biết nó có dùng được không, phải đo trên đúng thứ nó sẽ gặp: câu yêu cầu thật của tin và
câu thật của CV mà bi-encoder chọn ra. Script lấy các cặp đó như sản phẩm sẽ làm:

- chỉ câu yêu cầu loại `skill` (`facts.requirement_kind`), từ bốn từ trở lên;
- với mỗi câu yêu cầu, các câu của CV thuộc mục kinh nghiệm, dự án, tóm tắt được xếp
  theo cosine của bi-encoder; lấy câu đứng đầu, và câu thứ hai ở một nửa số trường hợp.

Hai phần, không trộn:
- `calibration`: 14 tin của tập hiệu chỉnh, mỗi tin ba CV (nhãn rubric cao, vừa, thấp):
  dùng để chọn hai ngưỡng "đạt" và "có liên quan";
- `validation`: 10 tin validation của tập vàng, mỗi tin hai CV (nhãn cao, nhãn thấp):
  chỉ dùng để báo cáo AUC và precision với ngưỡng đã chọn.

Phiếu mù ở `ml/data/requirement_eval/batch_<phần>.json`: mỗi dòng `{id, requirement,
sentence}`, không có mã tin, mã CV, nhãn rubric hay điểm của mô hình. Người gán (mô hình
ngôn ngữ, theo `ml/labeling/requirement_rubric.md`) ghi `labels_<phần>_<lượt>.json`.
`merge` gộp hai lượt độc lập (lệch thì lấy mức thấp hơn) thành
`ml/labeling/requirement_labels.json` và ghi `ml/reports/requirement_labels.md`.
"""

import argparse
import json
import os
import random
from collections import Counter

from build_train_pairs import DROPPED_CV_SECTIONS, export_texts
from evaluate import gold_pairs
from paths import DATA_DIR, JD_IMPORT_MAP, LABELING_DIR, MODELS_DIR, PROFILES_DIR, REPORTS_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST
from sklearn.metrics import cohen_kappa_score

SEED = 42
MODEL = 'multilingual-e5-base/wise-v1'
EVIDENCE_SECTIONS = ('experience', 'projects', 'summary', 'other')
MIN_WORDS = 4
REQUIREMENTS_PER_PAIR = 5
EVAL_DIR = DATA_DIR / 'requirement_eval'
POOL = EVAL_DIR / 'pool.json'
LABELS = LABELING_DIR / 'requirement_labels.json'
ORDER = {'unmet': 0, 'partial': 1, 'met': 2}


def job_requirements():
    """{mã tin: [câu yêu cầu loại skill]} của 100 tin thật."""
    codes = {value['job_public_id']: code for code, value in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()}
    found = {}
    for row in map(json.loads, (PROFILES_DIR / 'jd.jsonl').read_text(encoding='utf-8').splitlines()):
        code = codes.get(row['job_public_id'])
        if code:
            found[code] = [item['text'] for item in row.get('requirements', []) if item['kind'] == 'skill' and len(item['text'].split()) >= MIN_WORDS]
    return found


def calibration_documents(rng):
    """(mã tin, mã CV, các câu CV) cho ba CV mỗi tin hiệu chỉnh: nhãn ≥ 3, nhãn 2, nhãn ≤ 1."""
    labels = json.loads((LABELING_DIR / 'calibration_labels.json').read_text(encoding='utf-8'))['pairs']
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    chosen = []
    for job in sorted({row['jd'] for row in labels}):
        rows = [row for row in labels if row['jd'] == job]
        for wanted in (lambda label: label >= 3, lambda label: label == 2, lambda label: label <= 1):
            group = [row for row in rows if wanted(row['label'])]
            if group:
                chosen.append(rng.choice(group))
    items = [
        {'id': code, 'kind': 'cv', 'language': manifest[code]['language'],
         'data': {key: value for key, value in json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8')).items() if key not in DROPPED_CV_SECTIONS}}
        for code in sorted({row['cv'] for row in chosen})
    ]  # fmt: skip
    texts = export_texts(items)
    return [(row['jd'], row['cv'], row['label'], texts[row['cv']]['chunks']) for row in chosen if row['cv'] in texts]


def validation_documents(rng):
    """(mã tin, mã CV, các câu CV) cho hai CV mỗi tin validation của tập vàng: nhãn cao nhất và một nhãn ≤ 1."""
    chunks = {
        row['code']: row['profile']['chunks']
        for row in map(json.loads, (PROFILES_DIR / 'cv.jsonl').read_text(encoding='utf-8').splitlines())
        if 'profile' in row
    }
    pairs = [pair for pair in gold_pairs('validation') if pair['cv'] in chunks]
    chosen = []
    for job in dict.fromkeys(pair['jd'] for pair in pairs):
        rows = sorted((pair for pair in pairs if pair['jd'] == job), key=lambda pair: -pair['label'])
        low = [pair for pair in rows if pair['label'] <= 1]
        chosen += [rows[0], *([rng.choice(low)] if low else [])]
    return [(pair['jd'], pair['cv'], pair['label'], chunks[pair['cv']]) for pair in chosen]


def build():
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
    os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')
    from sentence_transformers import SentenceTransformer

    rng = random.Random(SEED)
    requirements = job_requirements()
    model = SentenceTransformer(str(MODELS_DIR / MODEL), device='mps')
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    pool = []
    for part, documents in (('calibration', calibration_documents(rng)), ('validation', validation_documents(rng))):
        rows = []
        for job, cv, label, chunks in documents:
            sentences = [chunk['text'] for chunk in chunks if chunk['section'] in EVIDENCE_SECTIONS]
            wanted = requirements.get(job, [])
            if not sentences or not wanted:
                continue
            wanted = rng.sample(wanted, min(REQUIREMENTS_PER_PAIR, len(wanted)))
            scores = model.encode(['query: ' + text for text in wanted], normalize_embeddings=True) @ model.encode(
                ['passage: ' + text for text in sentences], normalize_embeddings=True
            ).T
            for requirement, row in zip(wanted, scores, strict=True):
                ranked = row.argsort()[::-1]
                for rank in range(2 if rng.random() < 0.5 and len(ranked) > 1 else 1):
                    rows.append({'part': part, 'job': job, 'cv': cv, 'cv_label': label, 'requirement': requirement, 'sentence': sentences[ranked[rank]], 'rank': rank + 1, 'cosine': float(row[ranked[rank]])})  # fmt: skip
        rng.shuffle(rows)
        for number, row in enumerate(rows, start=1):
            row['id'] = f'{part[0].upper()}{number:03d}'
        pool += rows
        (EVAL_DIR / f'batch_{part}.json').write_text(
            json.dumps([{'id': row['id'], 'requirement': row['requirement'], 'sentence': row['sentence']} for row in rows], ensure_ascii=False, indent=1),
            encoding='utf-8',
        )  # fmt: skip
        print(f'{part}: {len(rows)} cặp từ {len(documents)} cặp tin–CV')
    POOL.write_text(json.dumps(pool, ensure_ascii=False, indent=1), encoding='utf-8')


def merge():
    pool = json.loads(POOL.read_text(encoding='utf-8'))
    merged, first, second = [], [], []
    for part in ('calibration', 'validation'):
        passes = [
            {row['id']: row for row in json.loads((EVAL_DIR / f'labels_{part}_{number}.json').read_text(encoding='utf-8'))}
            for number in (1, 2)
        ]
        for row in (row for row in pool if row['part'] == part):
            labels = [answers[row['id']]['label'] for answers in passes]
            if any(label not in ORDER for label in labels):
                raise SystemExit(f'Nhãn không hợp lệ ở {row["id"]}: {labels}')
            first.append(labels[0])
            second.append(labels[1])
            merged.append({**{key: row[key] for key in ('id', 'part', 'job', 'cv', 'requirement', 'sentence', 'rank')}, 'label': min(labels, key=ORDER.get), 'passes': labels})  # fmt: skip
    LABELS.write_text(json.dumps({'annotator': 'claude', 'rubric': 'ml/labeling/requirement_rubric.md', 'pairs': merged}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')  # fmt: skip
    same = sum(a == b for a, b in zip(first, second, strict=True))
    kappa = cohen_kappa_score([ORDER[label] for label in first], [ORDER[label] for label in second], weights='quadratic')
    lines = [
        '# Nhãn cặp yêu cầu – câu CV',
        '',
        f'{len(merged)} cặp thật lấy từ đường ống (câu yêu cầu của tin, câu CV do bi-encoder chọn), hai lượt gán độc lập do mô hình',
        'ngôn ngữ (Claude) thực hiện theo `ml/labeling/requirement_rubric.md`, không thấy mã tin, mã CV hay điểm của mô hình.',
        f'Hai lượt trùng nhau {same}/{len(merged)} cặp, kappa có trọng số bậc hai {kappa:.3f}'.replace('.', ',') + '; cặp lệch lấy mức thấp hơn.',
        'Tạo bằng `ml/scripts/build_requirement_eval.py merge`.',
        '',
        '| Phần | Số cặp | Đạt | Có liên quan | Không đạt |',
        '| --- | ---: | ---: | ---: | ---: |',
    ]
    for part in ('calibration', 'validation'):
        counts = Counter(row['label'] for row in merged if row['part'] == part)
        lines.append(f'| {part} | {sum(counts.values())} | {counts["met"]} | {counts["partial"]} | {counts["unmet"]} |')
    REPORTS_DIR.joinpath('requirement_labels.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('step', nargs='?', choices=['build', 'merge'], default='build')
    merge() if parser.parse_args().step == 'merge' else build()
