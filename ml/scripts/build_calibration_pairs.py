"""Ghép cặp cho tập hiệu chỉnh và gộp nhãn sau khi gán.

    ml/.venv/bin/python ml/scripts/build_calibration_pairs.py          # ghép cặp, ghi phiếu mù
    ml/.venv/bin/python ml/scripts/build_calibration_pairs.py merge    # gộp nhãn đã gán

Tập hiệu chỉnh dùng để chọn checkpoint, chọn cấu hình và đặt mốc quy đổi điểm; nó
không vào huấn luyện và không phải tập đánh giá cuối (đó là tập vàng).

Ghép cặp: 14 tin trong `ml/labeling/calibration_jobs.json`. Mọi CV đều lấy từ kho CV
của chính 14 tin này (đã qua cổng chất lượng), nên không CV nào của tập hiệu chỉnh có
mặt trong dữ liệu huấn luyện. Với mỗi tin:
- mọi CV neo vào chính tin đó (đủ ba mức khớp mạnh, khớp một phần, vị trí gần);
- 5 CV của tin hiệu chỉnh khác cùng nhóm ngành (thiếu thì lấy thêm theo độ giống);
- 4 CV giống tin nhất theo TF-IDF trong phần còn lại (mẫu âm khó);
- 4 CV ngẫu nhiên trong phần còn lại (phần lớn khác ngành).

Phiếu mù: `ml/data/calibration/batch_<mã tin>.json`, mỗi tệp một tin kèm các CV đã xáo
và mang mã ẩn (C01, C02…), không có mức khớp dự kiến, tin neo hay nguồn ghép. Người gán (mô hình ngôn ngữ, theo
`ml/labeling/rubric.md`) ghi `labels_<mã tin>.json` cạnh đó. Nguồn ghép của từng cặp
nằm ở `ml/data/labels/calibration_pool.json` và không được xem khi gán.

`merge` gộp nhãn thành `ml/labeling/calibration_labels.json` và ghi
`ml/reports/calibration_labels.md`: phân bố nhãn và bảng đối chiếu nhãn yếu của máy
sinh với nhãn theo rubric.
"""

import argparse
import json
import random
from collections import Counter, defaultdict

from build_audit_page import job_records, without_hidden
from corpus import cv_text, tokenize
from generate_cvs import load_jobs
from paths import (
    CALIBRATION_JOBS,
    DATA_DIR,
    LABELING_DIR,
    LABELS_DIR,
    REPORTS_DIR,
    TRAIN_CV_DIR,
    TRAIN_CV_MANIFEST,
)
from sklearn.feature_extraction.text import TfidfVectorizer

SEED = 42
SAME_GROUP, SIMILAR, RANDOM = 5, 4, 4
BATCH_DIR = DATA_DIR / 'calibration'
POOL = LABELS_DIR / 'calibration_pool.json'
LABELS = LABELING_DIR / 'calibration_labels.json'
# Mục của CV không đưa cho người gán: như văn bản huấn luyện (`build_train_pairs.py`).
DROPPED = ('activities', 'awards', 'interests')


def held_out_cvs(jobs):
    """{mã CV: (facts, dữ liệu)} của các CV qua cổng, neo vào tin hiệu chỉnh."""
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    gate = json.loads((TRAIN_CV_DIR / 'gate.json').read_text(encoding='utf-8'))
    cvs = {}
    for code, facts in manifest.items():
        if facts['anchor_job'] in jobs and not gate.get(code, ['chưa kiểm']):
            data = json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))
            cvs[code] = (facts, {key: value for key, value in data.items() if key not in DROPPED})
    return cvs


def build():
    rng = random.Random(SEED)
    jobs = json.loads(CALIBRATION_JOBS.read_text(encoding='utf-8'))['jobs']
    sheet = {job['code']: job for job in load_jobs()}
    records = job_records(set(jobs))
    cvs = held_out_cvs(set(jobs))
    codes = sorted(cvs)
    texts = [cv_text(cvs[code][1]) for code in codes]
    vectorizer = TfidfVectorizer(tokenizer=tokenize, lowercase=False, token_pattern=None, sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    pool = []
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    for job in jobs:
        query = '\n'.join([records[job]['title'], records[job]['description'], records[job]['requirements']])
        scores = (matrix @ vectorizer.transform([query]).T).toarray().ravel()
        ranked = [codes[index] for index in scores.argsort()[::-1]]
        chosen = {code: 'own' for code in codes if cvs[code][0]['anchor_job'] == job}
        group = [code for code in ranked if code not in chosen and sheet[cvs[code][0]['anchor_job']]['group'] == sheet[job]['group']]
        for code in rng.sample(group, min(SAME_GROUP, len(group))):
            chosen[code] = 'same_group'
        for code in [code for code in ranked if code not in chosen][: SIMILAR + SAME_GROUP - sum(v == 'same_group' for v in chosen.values())]:
            chosen[code] = 'similar'
        rest = [code for code in codes if code not in chosen]
        for code in rng.sample(rest, min(RANDOM, len(rest))):
            chosen[code] = 'random'
        order = sorted(chosen)
        rng.shuffle(order)
        # Mã CV thật (TR-<tin>-<số>) lộ tin neo, nên phiếu dùng mã ẩn C01, C02…
        hidden = {code: f'C{number:02d}' for number, code in enumerate(order, start=1)}
        pool += [{'jd': job, 'cv': code, 'id': hidden[code], 'source': chosen[code]} for code in order]
        batch = {
            'jd': {key: records[job][key] for key in ('code', 'title', 'facts', 'required', 'preferred', 'description', 'requirements')},
            'cvs': [{'cv': hidden[code], 'content': without_hidden(cvs[code][1])} for code in order],
        }
        (BATCH_DIR / f'batch_{job}.json').write_text(json.dumps(batch, ensure_ascii=False, indent=1), encoding='utf-8')
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    POOL.write_text(json.dumps({'seed': SEED, 'pairs': pool}, ensure_ascii=False, indent=1), encoding='utf-8')
    sources = Counter(pair['source'] for pair in pool)
    print(f'{len(pool)} cặp của {len(jobs)} tin, {len(codes)} CV; theo nguồn: {dict(sources)}. Phiếu mù ở {BATCH_DIR}.')


def merge():
    pool = json.loads(POOL.read_text(encoding='utf-8'))['pairs']
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    labels, missing = {}, []
    for job in dict.fromkeys(pair['jd'] for pair in pool):
        path = BATCH_DIR / f'labels_{job}.json'
        rows = {row['cv']: row for row in json.loads(path.read_text(encoding='utf-8'))} if path.exists() else {}
        for pair in pool:
            if pair['jd'] != job:
                continue
            row = rows.get(pair['id'])
            if row is None or row.get('label') not in (0, 1, 2, 3, 4):
                missing.append(f'{job} × {pair["cv"]}')
            else:
                labels[(job, pair['cv'])] = row
    if missing:
        raise SystemExit(f'Thiếu hoặc sai nhãn ở {len(missing)} cặp: {", ".join(missing[:8])}…')
    rows = [
        {'jd': job, 'cv': cv, 'label': row['label'], 'confidence': row.get('confidence', ''), 'reason': row.get('reason', '')}
        for (job, cv), row in labels.items()
    ]
    LABELS.write_text(
        json.dumps({'annotator': 'claude', 'rubric': 'ml/labeling/rubric.md', 'pairs': rows}, ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8',
    )
    source = {(pair['jd'], pair['cv']): pair['source'] for pair in pool}
    table = defaultdict(Counter)
    for (job, cv), row in labels.items():
        weak = manifest[cv]['intended_match'] if source[(job, cv)] == 'own' else f'CV của tin khác ({source[(job, cv)]})'
        table[weak][row['label']] += 1
    counts = Counter(row['label'] for row in rows)
    lines = [
        '# Nhãn của tập hiệu chỉnh',
        '',
        f'{len(rows)} cặp của {len({row["jd"] for row in rows})} tin ngoài tập vàng, nhãn 0–4 do mô hình ngôn ngữ (Claude) gán',
        'theo `ml/labeling/rubric.md`, không xem mức khớp dự kiến hay nguồn ghép cặp. Tạo bằng',
        '`ml/scripts/build_calibration_pairs.py merge`.',
        '',
        'Số cặp theo nhãn 0–4: ' + ', '.join(str(counts[label]) for label in range(5)) + '.',
        '',
        '## Nhãn yếu của máy sinh so với nhãn theo rubric',
        '',
        '| Nhãn yếu | Số cặp | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 | Trung bình |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    for weak in sorted(table, key=lambda name: -sum(label * count for label, count in table[name].items()) / sum(table[name].values())):
        row = table[weak]
        total = sum(row.values())
        mean = sum(label * count for label, count in row.items()) / total
        lines.append(f'| {weak} | {total} | ' + ' | '.join(str(row[label]) for label in range(5)) + f' | {mean:.2f}'.replace('.', ',') + ' |')
    REPORTS_DIR.joinpath('calibration_labels.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('step', nargs='?', choices=['build', 'merge'], default='build')
    merge() if parser.parse_args().step == 'merge' else build()
