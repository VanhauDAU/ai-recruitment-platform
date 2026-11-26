"""Phân tích lỗi của công thức đang chạy trên phần validation của tập vàng.

    ml/.venv/bin/python ml/scripts/evaluate.py          # ghi ml/data/eval/product.jsonl
    ml/.venv/bin/python ml/scripts/error_analysis.py

Đọc điểm từng cặp mà `evaluate.py` vừa ghi (không chạy lại mô hình) và trả lời ba câu
hỏi trước khi huấn luyện:
1. Tín hiệu nào đi cùng nhãn: Spearman của từng tiêu chí và từng độ tương đồng.
2. Cosine của bi-encoder tách các nhãn tới đâu: khoảng cosine theo nhãn.
3. Cặp nào lệch mức: mức hiển thị cách mức đúng của nhãn từ hai bậc, hoặc cặp nhãn
   3–4 không được "Phù hợp", hoặc cặp nhãn 0–1 được từ 50 điểm.

Chỉ dùng phần validation; phần test không được soi lỗi. Kết quả:
`ml/reports/error_analysis_validation.md`.
"""

import json

import numpy as np
from evaluate import BAND_NAMES, LABEL_BAND, band, gold_pairs, number, spearman
from paths import EVAL_DIR, JD_IMPORT_MAP, REPORTS_DIR

CRITERIA = ('skills', 'experience', 'education', 'position_level', 'languages')
SIGNALS = (
    ('Điểm tổng', lambda row: row.get('score')),
    ('Luật `profile-rule-v2`', lambda row: row.get('rule_score')),
    ('Cosine toàn văn', lambda row: row.get('document_similarity')),
    ('Cosine chức danh', lambda row: row.get('title_similarity')),
    *((f'Tiêu chí `{key}`', lambda row, key=key: (row.get('components') or {}).get(key)) for key in CRITERIA),
)


def load():
    """Cặp validation kèm dòng kết quả của sản phẩm."""
    jobs = json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8'))
    lines = (EVAL_DIR / 'product.jsonl').read_text(encoding='utf-8').splitlines()
    rows = {(row['jd'], row['cv']): row for row in map(json.loads, lines)}
    pairs = gold_pairs('validation')
    return [(pair, rows[(jobs[pair['jd']]['job_public_id'], pair['cv'])]) for pair in pairs]


def signal_rows(data):
    lines = ['| Tín hiệu | Số cặp có giá trị | Spearman với nhãn |', '| --- | ---: | ---: |']
    for name, read in SIGNALS:
        known = [(read(row), pair['label']) for pair, row in data if read(row) is not None]
        values, gold = (np.array(column, dtype=float) for column in zip(*known, strict=True))
        lines.append(f'| {name} | {len(known)} | {number(spearman(values, gold))} |')
    return lines


def cosine_rows(data):
    lines = [
        '| Nhãn | Số cặp | Toàn văn: thấp nhất | trung vị | cao nhất | Chức danh: trung vị |',
        '| ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    for label in range(5):
        rows = [row for pair, row in data if pair['label'] == label]
        document = [row['document_similarity'] for row in rows if row.get('document_similarity') is not None]
        title = [row['title_similarity'] for row in rows if row.get('title_similarity') is not None]
        if document:
            lines.append(
                f'| {label} | {len(rows)} | {number(min(document))} | {number(float(np.median(document)))} | '
                f'{number(max(document))} | {number(float(np.median(title))) if title else "–"} |'
            )
    return lines


def is_off(pair, row):
    score, label = row.get('score'), pair['label']
    if score is None:
        return False
    return abs(band(score) - LABEL_BAND[label]) >= 2 or (label >= 3 and score < 65) or (label <= 1 and score >= 50)


def off_rows(data):
    lines = [
        '| Tin | CV | Nhãn | Điểm | Mức hiển thị | Kỹ năng | Kinh nghiệm | Cosine toàn văn | Cosine chức danh |',
        '| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |',
    ]
    chosen = sorted(
        (item for item in data if is_off(*item)), key=lambda item: (-item[0]['label'], item[1]['score'])
    )
    for pair, row in chosen:
        parts = row.get('components') or {}
        lines.append(
            f'| {pair["jd"]} | {pair["cv"]} | {pair["label"]} | {row["score"]} | {BAND_NAMES[band(row["score"])]} | '
            f'{number(parts.get("skills"), 0)} | {number(parts.get("experience"), 0)} | '
            f'{number(row.get("document_similarity"))} | {number(row.get("title_similarity"))} |'
        )
    return lines, len(chosen)


def main():
    data = load()
    version = next((row['model_version'] for _, row in data if 'model_version' in row), '?')
    off, count = off_rows(data)
    lines = [
        '# Phân tích lỗi trên tập vàng, phần validation',
        '',
        f'{len(data)} cặp, mô hình `{version}`. Tạo bằng `ml/scripts/error_analysis.py` từ điểm từng cặp',
        'của `evaluate.py`.',
        '',
        '## Tín hiệu nào đi cùng nhãn',
        '',
        *signal_rows(data),
        '',
        '## Cosine của bi-encoder theo nhãn',
        '',
        *cosine_rows(data),
        '',
        f'## Cặp lệch mức ({count} cặp)',
        '',
        'Mức hiển thị cách mức đúng của nhãn từ hai bậc, hoặc nhãn 3–4 dưới 65 điểm, hoặc nhãn 0–1 từ 50 điểm.',
        '',
        *off,
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    text = '\n'.join(lines) + '\n'
    (REPORTS_DIR / 'error_analysis_validation.md').write_text(text, encoding='utf-8')
    print(text)


if __name__ == '__main__':
    main()
