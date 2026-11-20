"""Ghép bộ ba huấn luyện bi-encoder (kế hoạch bản 3, mục 3.2).

    ml/.venv/bin/python ml/scripts/build_train_pairs.py

Mỗi dòng là `{anchor, positive, negative, source}`: `anchor` là văn bản của một tin,
`positive` là văn bản nên đứng gần tin đó, `negative` là văn bản giống bề ngoài nhưng
kém phù hợp hơn. Văn bản lấy đúng như sản phẩm đưa vào mô hình: tin trong DB qua
`matching_export_dataset jobs` (trường `text`), tài liệu ngoài DB qua
`matching_export_dataset texts`. Tiền tố E5 (`query: `, `passage: `) do `train.py` thêm.

| Nguồn | Tin (anchor) | Dương | Âm |
| --- | --- | --- | --- |
| K3 CV huấn luyện | tin neo | CV khớp mạnh của tin | CV khớp một phần hoặc vị trí gần của chính tin đó |
| K3 chức danh | chức danh tin neo | chức danh CV khớp mạnh | chức danh CV vị trí gần |
| K1 cùng vị trí | tin | CV khớp mạnh của tin khác cùng vị trí chuyên môn | CV khớp mạnh của vị trí khác cùng nhóm ngành |
| K2 VietJobs | tiêu đề + yêu cầu | mô tả của chính tin | mô tả của tin khác cùng ngành |
| K4 resume–JD fit | mô tả tin (tiếng Anh) | CV "Good Fit" | CV "No Fit" của cùng tin |

Chống rò rỉ sang tập đánh giá:
- 30 tin của tập vàng không bao giờ làm tin neo; 100 CV tổng hợp đầu (đều dùng trong
  tập vàng) không vào dữ liệu huấn luyện;
- tin VietJobs giống một tin vàng (trùng tên vị trí hoặc Jaccard từ của mô tả ≥ 0,5)
  bị loại, vì hai nguồn cùng lấy từ các trang tuyển dụng Việt Nam.

Tập dev (chọn checkpoint, không phải tập đánh giá): 7 tin neo giữ riêng cùng mọi CV của
chúng. Kết quả: `ml/data/pairs/train.jsonl`, `dev.json`, `ml/reports/train_pairs.md`.
"""

import json
import random
import re
import subprocess
from collections import Counter, defaultdict

import pandas as pd
from build_gold_pairs import EXTENSION_JDS, GOLD_JDS
from paths import (
    JD_IMPORT_MAP,
    PAIRS_DIR,
    PROFILES_DIR,
    PUBLIC_DIR,
    REPO_ROOT,
    REPORTS_DIR,
    TRAIN_CV_DIR,
    TRAIN_CV_MANIFEST,
)

SEED = 42
DEV_ANCHORS = 7
# Dữ liệu công khai chỉ bổ trợ: CV huấn luyện neo vào tin thật vẫn là phần lớn.
VIETJOBS_ROWS = 1500
RESUME_FIT_ROWS = 1000
K1_PER_ANCHOR = 3
MAX_CHARS = 2000
LEAK_JACCARD = 0.5
GOLD = {*GOLD_JDS, *EXTENSION_JDS}


def export_texts(items):
    """Văn bản của tài liệu ngoài DB qua đúng hàm dựng chunk của backend."""
    payload = ''.join(json.dumps(item, ensure_ascii=False) + '\n' for item in items)
    result = subprocess.run(
        ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'matching_export_dataset', 'texts'],
        input=payload, capture_output=True, text=True, cwd=REPO_ROOT, check=False,
    )  # fmt: skip
    if result.returncode != 0:
        raise SystemExit(f'matching_export_dataset texts lỗi:\n{result.stderr[-2000:]}')
    return {row['id']: row for row in map(json.loads, result.stdout.splitlines()) if 'error' not in row}


def word_set(text):
    return set(re.findall(r'\w+', str(text).casefold()))


def job_texts():
    """{mã tin: {text, title}} của 100 tin thật (văn bản sản phẩm, từ `jd.jsonl`)."""
    codes = {value['job_public_id']: code for code, value in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()}  # fmt: skip
    jobs = {}
    for row in map(json.loads, (PROFILES_DIR / 'jd.jsonl').read_text(encoding='utf-8').splitlines()):
        code = codes.get(row['job_public_id'])
        if code and 'text' in row:
            title = next((chunk['text'] for chunk in row['profile']['chunks'] if chunk['section'] == 'title'), '')
            jobs[code] = {'text': row['text'], 'title': title}
    missing = [code for code in codes.values() if code not in jobs]
    if missing:
        raise SystemExit(f'jd.jsonl thiếu trường text cho {len(missing)} tin; chạy lại export_profiles.py.')
    return jobs


def train_cvs():
    """CV huấn luyện đã qua cổng chất lượng: {mã: facts + văn bản sản phẩm}."""
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    gate = json.loads((TRAIN_CV_DIR / 'gate.json').read_text(encoding='utf-8'))
    passed = [code for code in manifest if code in gate and not gate[code]]
    items = [
        {'id': code, 'kind': 'cv', 'language': manifest[code]['language'],
         'data': json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))}
        for code in passed
    ]  # fmt: skip
    texts = export_texts(items)
    return {code: {**manifest[code], **texts[code]} for code in passed if code in texts}


def k3_rows(jobs, cvs, anchors, rng):
    by_anchor = defaultdict(lambda: defaultdict(list))
    for code, cv in cvs.items():
        by_anchor[cv['anchor_job']][cv['intended_match']].append(code)
    rows = []
    for anchor in anchors:
        groups = by_anchor.get(anchor, {})
        weaker = groups.get('partial', []) + groups.get('adjacent', [])
        for strong in groups.get('strong', []):
            # Mọi cặp (CV mạnh, CV yếu hơn) của cùng tin: dạy thứ tự trong cùng một nghề.
            for negative in weaker:
                rows.append({'anchor': jobs[anchor]['text'], 'positive': cvs[strong]['text'], 'negative': cvs[negative]['text'], 'source': 'K3'})  # fmt: skip
            for adjacent in groups.get('adjacent', [])[:1]:
                if cvs[strong]['title'] and cvs[adjacent]['title'] and jobs[anchor]['title']:
                    rows.append({'anchor': jobs[anchor]['title'], 'positive': cvs[strong]['title'], 'negative': cvs[adjacent]['title'], 'source': 'K3-title'})  # fmt: skip
    return rows


def k1_rows(jobs, cvs, anchors, specialization, group, rng):
    strong = defaultdict(list)
    for code, cv in cvs.items():
        if cv['intended_match'] == 'strong' and cv['anchor_job'] in anchors:
            strong[cv['anchor_job']].append(code)
    rows = []
    for anchor in anchors:
        same = [code for other in anchors if other != anchor and specialization[other] == specialization[anchor] for code in strong[other]]  # fmt: skip
        near = [code for other in anchors if group[other] == group[anchor] and specialization[other] != specialization[anchor] for code in strong[other]]  # fmt: skip
        for positive in rng.sample(same, min(K1_PER_ANCHOR, len(same))):
            if near:
                rows.append({'anchor': jobs[anchor]['text'], 'positive': cvs[positive]['text'], 'negative': cvs[rng.choice(near)]['text'], 'source': 'K1'})  # fmt: skip
    return rows


def k2_rows(gold_texts, gold_roles, rng):
    frame = pd.read_csv(PUBLIC_DIR / 'vietjobs' / 'VietJobs.csv')
    frame = frame.dropna(subset=['job_title', 'description', 'requirements_text'])
    frame = frame.drop_duplicates(subset=['description']).drop_duplicates(subset=['job_title', 'requirements_text'])
    # Lấy mẫu đều theo ngành (ngành lớn như kinh doanh không lấn hết).
    per_category = VIETJOBS_ROWS * 2 // frame['category'].nunique()
    frame = frame.sample(frac=1, random_state=SEED).groupby('category').head(per_category)
    gold_bags = [word_set(text) for text in gold_texts]
    keep, leaked = [], 0
    for row in frame.itertuples():
        bag = word_set(row.description)
        role = str(row.job_title).strip().casefold()
        if role in gold_roles or any(len(bag & other) / max(1, len(bag | other)) >= LEAK_JACCARD for other in gold_bags):
            leaked += 1
            continue
        keep.append(row)
    items = [
        {'id': f'VJ-{index}', 'kind': 'job', 'title': row.job_title, 'description': '', 'requirements': row.requirements_text}
        for index, row in enumerate(keep)
    ]  # fmt: skip
    texts = export_texts(items)
    by_category = defaultdict(list)
    for index, row in enumerate(keep):
        if f'VJ-{index}' in texts:
            by_category[row.category].append((texts[f'VJ-{index}']['text'], str(row.description)[:MAX_CHARS], row.job_title))
    rows = []
    for category, entries in by_category.items():
        for anchor, positive, title in entries:
            others = [entry for entry in entries if entry[2] != title]
            if others:
                rows.append({'anchor': anchor, 'positive': positive, 'negative': rng.choice(others)[1], 'source': 'K2'})  # fmt: skip
    rng.shuffle(rows)
    return rows[:VIETJOBS_ROWS], leaked


def k4_rows(rng):
    frame = pd.read_csv(PUBLIC_DIR / 'resume_job_fit' / 'train.csv')
    rows = []
    for description, group in frame.groupby('job_description_text'):
        good = group.loc[group['label'] == 'Good Fit', 'resume_text'].tolist()
        bad = group.loc[group['label'] == 'No Fit', 'resume_text'].tolist()
        for index, positive in enumerate(good):
            if bad:
                rows.append({'anchor': description[:MAX_CHARS], 'positive': positive[:MAX_CHARS], 'negative': bad[index % len(bad)][:MAX_CHARS], 'source': 'K4'})  # fmt: skip
    rng.shuffle(rows)
    return rows[:RESUME_FIT_ROWS]


def dev_set(jobs, cvs, anchors):
    """Tập dev cho `InformationRetrievalEvaluator`: tin → CV khớp mạnh của chính tin đó."""
    corpus = {code: cv['text'] for code, cv in cvs.items() if cv['anchor_job'] in anchors}
    relevant = {anchor: [code for code in corpus if cvs[code]['anchor_job'] == anchor and cvs[code]['intended_match'] == 'strong'] for anchor in anchors}  # fmt: skip
    return {
        'queries': {anchor: jobs[anchor]['text'] for anchor in anchors if relevant[anchor]},
        'corpus': corpus,
        'relevant': {anchor: codes for anchor, codes in relevant.items() if codes},
    }


def main():
    rng = random.Random(SEED)
    jobs = job_texts()
    cvs = train_cvs()
    from generate_cvs import load_jobs  # danh mục vị trí chuyên môn và nhóm ngành của 100 tin

    sheet = {job['code']: job for job in load_jobs()}
    anchors = sorted({cv['anchor_job'] for cv in cvs.values()} - GOLD)
    if set(anchors) & GOLD or any(code.startswith('CV-') for code in cvs):
        raise SystemExit('Rò rỉ: tin vàng hoặc CV của tập vàng lọt vào dữ liệu huấn luyện.')
    shuffled = anchors[:]
    rng.shuffle(shuffled)
    dev_anchors, train_anchors = sorted(shuffled[:DEV_ANCHORS]), sorted(shuffled[DEV_ANCHORS:])

    specialization = {code: sheet[code]['specialization'] for code in anchors}
    group = {code: sheet[code]['group'] for code in anchors}
    rows = k3_rows(jobs, cvs, train_anchors, rng)
    rows += k1_rows(jobs, cvs, train_anchors, specialization, group, rng)
    gold_texts = [jobs[code]['text'] for code in GOLD]
    gold_roles = {jobs[code]['title'].casefold() for code in GOLD}
    vietjobs, leaked = k2_rows(gold_texts, gold_roles, rng)
    rows += vietjobs + k4_rows(rng)
    rng.shuffle(rows)

    PAIRS_DIR.mkdir(parents=True, exist_ok=True)
    with (PAIRS_DIR / 'train.jsonl').open('w', encoding='utf-8') as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False) + '\n')
    dev = dev_set(jobs, cvs, dev_anchors)
    (PAIRS_DIR / 'dev.json').write_text(json.dumps(dev, ensure_ascii=False), encoding='utf-8')

    counts = Counter(row['source'] for row in rows)
    lines = [
        '# Dữ liệu huấn luyện bi-encoder',
        '',
        f'{len(rows)} bộ ba (tin, dương, âm). {len(cvs)} CV huấn luyện qua cổng chất lượng, neo vào '
        f'{len(train_anchors)} tin huấn luyện; {len(dev_anchors)} tin giữ riêng làm dev '
        f'({len(dev["corpus"])} CV, {sum(map(len, dev["relevant"].values()))} cặp dương). '
        'Tạo bằng `ml/scripts/build_train_pairs.py`.',
        '',
        '| Nguồn | Số bộ ba |',
        '| --- | ---: |',
        *[f'| {source} | {counts[source]} |' for source in ('K3', 'K3-title', 'K1', 'K2', 'K4')],
        '',
        f'Chống rò rỉ: 30 tin vàng không làm tin neo, 100 CV của tập vàng không dùng; {leaked} tin '
        'VietJobs bị loại vì giống một tin vàng.',
        f'Tin dev: {", ".join(dev_anchors)}.',
    ]
    REPORTS_DIR.joinpath('train_pairs.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
