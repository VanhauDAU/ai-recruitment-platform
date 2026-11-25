"""Đo độ phân biệt và mốc hiệu chuẩn của các phép so ngữ nghĩa.

So cặp khớp mạnh (CV `strong` với tin neo) với cặp khác ngành (mỗi CV với vài tin
thuộc nhóm ngành khác) theo bốn phép đo, kèm AUC:

- `toàn văn`: cosine vector toàn văn tin (query) ↔ toàn văn CV (passage);
- `chức danh`: cosine tên vị trí trong tiêu đề tin ↔ headline/chức danh gần nhất của CV;
- `MaxSim yêu cầu`: trung bình, trên các câu yêu cầu, của cosine lớn nhất với câu CV;
- `kỹ năng`: cosine tên kỹ năng của tin ↔ câu CV gần nhất.

Mốc đặt vào `CALIBRATIONS` (`apps/matching/services/scoring/semantic.py`):
`low` = trung vị cặp khác ngành (0 điểm), `high` = phân vị 90 cặp khớp mạnh
(100 điểm); ngưỡng kỹ năng và ngưỡng "đạt" của từng yêu cầu lấy phân vị 95 của
cặp khác ngành để ít nhận nhầm. Tuần 3 dùng nhãn yếu; tuần 6 chạy lại với nhãn
người chấm.

Chạy sau `export_profiles.py`: ml/.venv/bin/python ml/scripts/calibrate.py
"""

import json
import os
import random
import statistics

import numpy as np
from paths import CV_MANIFEST, JD_IMPORT_MAP, MODELS_DIR, PROFILES_DIR, REPORTS_DIR
from sklearn.metrics import roc_auc_score

MODEL = MODELS_DIR / 'multilingual-e5-base' / 'zs-v1'
MODEL_VERSION = 'e5-base-zs-v1'
# Cùng quy tắc với backend (scoring.criteria.EXPERIENCE_SECTIONS, documents.document_text).
EXPERIENCE_SECTIONS = ('experience', 'projects', 'summary', 'other')
DOCUMENT_SECTIONS_EXCLUDED = ('skill',)
DOCUMENT_TEXT_MAX_CHARS = 2000
RANDOM_PER_CV = 3
SEED = 42


def load(name):
    return [json.loads(line) for line in (PROFILES_DIR / f'{name}.jsonl').open(encoding='utf-8')]


def make_encoder():
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
    os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(str(MODEL), device='mps')
    cache = {}

    def encode(texts, kind):
        prefix = 'query: ' if kind == 'query' else 'passage: '
        missing = [text for text in dict.fromkeys(texts) if (prefix, text) not in cache]
        if missing:
            vectors = model.encode([prefix + t for t in missing], batch_size=32, normalize_embeddings=True)
            cache.update({(prefix, t): v for t, v in zip(missing, vectors, strict=True)})
        return np.array([cache[(prefix, t)] for t in texts]).reshape(len(texts), -1)

    return encode


def document_text(profile):
    texts = [c['text'] for c in profile['chunks'] if c['section'] not in DOCUMENT_SECTIONS_EXCLUDED]
    return ' '.join(texts)[:DOCUMENT_TEXT_MAX_CHARS]


def title_chunk(profile):
    """Chunk chức danh (tin: phần tên vị trí của tiêu đề; CV: headline/chức danh gần nhất)."""
    return next((c['text'] for c in profile['chunks'] if c['section'] == 'title'), '')


def measures(cv, jd, encode):
    """Các phép đo của một cặp: số cho cả cặp, danh sách cho từng câu yêu cầu và kỹ năng."""
    chunks = cv['chunks']
    experience = [c['text'] for c in chunks if c['section'] in EXPERIENCE_SECTIONS] or [c['text'] for c in chunks]
    content = [c['text'] for c in chunks if c['section'] not in ('languages', 'skills')]
    requirements = [c['text'] for c in jd['chunks'] if c['section'] == 'requirement']
    jd_title, cv_title = title_chunk(jd), title_chunk(cv)
    row = {
        'toàn văn': float(encode([document_text(jd)], 'query')[0] @ encode([document_text(cv)], 'passage')[0]),
        'chức danh': float(encode([jd_title], 'query')[0] @ encode([cv_title], 'passage')[0]) if jd_title and cv_title else None,
        'requirement_max': [],
        'skills': [],
    }  # fmt: skip
    if requirements and experience:
        best = (encode(requirements, 'query') @ encode(experience, 'passage').T).max(axis=1)
        row['MaxSim yêu cầu'] = float(best.mean())
        row['requirement_max'] = best.tolist()
    own = {skill['skill_id'] for skill in cv['skills']}
    skills = [skill for skill in jd['skills'] if skill['counted']]
    if skills and content:
        best = (encode([s['name'] for s in skills], 'query') @ encode(content, 'passage').T).max(axis=1)
        row['skills'] = [(float(v), s['skill_id'] in own) for s, v in zip(skills, best, strict=True)]
    return row


def main():
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    code_by_public = {m['job_public_id']: c for c, m in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()}
    jds = {code_by_public[r['job_public_id']]: r['profile'] for r in load('jd') if r['job_public_id'] in code_by_public}
    cvs = {r['code']: r['profile'] for r in load('cv') if r['cv_type'] == 'builder'}
    cluster_of_jd = {facts['anchor_job']: facts['cluster'] for facts in manifest.values()}
    encode, rng = make_encoder(), random.Random(SEED)

    strong, unrelated = [], []
    for code, facts in sorted(manifest.items()):
        if facts['intended_match'] == 'strong':
            strong.append(measures(cvs[code], jds[facts['anchor_job']], encode))
        others = [jd for jd, cluster in cluster_of_jd.items() if cluster != facts['cluster']]
        unrelated += [measures(cvs[code], jds[jd], encode) for jd in rng.sample(others, RANDOM_PER_CV)]

    lines = [
        f'# Hiệu chuẩn zero-shot `{MODEL_VERSION}` (nhãn yếu)',
        '',
        f'{len(strong)} cặp khớp mạnh (CV `strong` với tin neo), {len(unrelated)} cặp khác ngành',
        f'(mỗi CV với {RANDOM_PER_CV} tin nhóm ngành khác). Tạo bằng `ml/scripts/calibrate.py`.',
        '',
        '| Phép đo | AUC | Khác ngành: trung vị | Khớp mạnh: trung vị | Khớp mạnh: P90 |',
        '| --- | ---: | ---: | ---: | ---: |',
    ]
    marks = {}
    for name in ('toàn văn', 'chức danh', 'MaxSim yêu cầu'):
        pos = [r[name] for r in strong if r.get(name) is not None]
        neg = [r[name] for r in unrelated if r.get(name) is not None]
        auc = roc_auc_score([1] * len(pos) + [0] * len(neg), pos + neg)
        marks[name] = (statistics.median(neg), float(np.percentile(pos, 90)))
        lines.append(
            f'| {name} | {auc:.3f} | {statistics.median(neg):.3f} | {statistics.median(pos):.3f} '
            f'| {np.percentile(pos, 90):.3f} |'
        )
    requirement_neg = [v for r in unrelated for v in r['requirement_max']]
    requirement_pos = [v for r in strong for v in r['requirement_max']]
    met = float(np.percentile(requirement_neg, 95))
    partial = float(np.percentile(requirement_neg, 80))
    skill_pos = [v for r in strong for v, has in r['skills'] if has]
    skill_neg = [v for r in unrelated for v, has in r['skills'] if not has]
    tau = float(np.percentile(skill_neg, 95))
    lines += [
        '',
        f'Từng câu yêu cầu: cosine lớn nhất với câu CV, cặp khác ngành P80 {partial:.3f} / P95 {met:.3f};',
        f'ở cặp khớp mạnh {np.mean(np.array(requirement_pos) >= met):.0%} câu yêu cầu vượt P95.',
        f'Kỹ năng: CV có kỹ năng trung vị {statistics.median(skill_pos):.3f}, tin khác ngành P95 {tau:.3f};',
        f'với τ_skill = {tau:.3f}, {np.mean(np.array(skill_pos) >= tau):.0%} kỹ năng CV có được nhận lại bằng câu.',
        '',
        'Kết luận: ở chế độ zero-shot, so từng câu (MaxSim) gần như không phân biệt được cặp khớp',
        'và cặp khác ngành, nên mức liên quan dùng vector toàn văn và chức danh; MaxSim chỉ dùng để',
        'chỉ ra câu bằng chứng cho từng yêu cầu, với ngưỡng chặt.',
        '',
        f'Mốc đặt vào `CALIBRATIONS["{MODEL_VERSION}"]`:',
        '',
        '```python',
        'Calibration(',
        f'    document=({marks["toàn văn"][0]:.3f}, {marks["toàn văn"][1]:.3f}),',
        f'    title=({marks["chức danh"][0]:.3f}, {marks["chức danh"][1]:.3f}),',
        f'    skill={tau:.3f},',
        f'    requirement_met={met:.3f},',
        f'    requirement_partial={partial:.3f},',
        ')',
        '```',
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / f'calibration_{MODEL_VERSION}.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
