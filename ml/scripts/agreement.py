"""Độ đồng thuận giữa nhãn của Claude và nhãn người làm đồ án chấm mù (30 cặp kiểm chứng).

Đầu vào: `ml/labeling/gold_pairs_claude.xlsx` (Claude, 150 cặp) và cột `label` của
`ml/labeling/gold_pairs.xlsx` ở các cặp trong `audit_pairs.json` (người).
Đo: quadratic weighted kappa (thước đo chính của rubric, ngưỡng ≥ 0,70), tỷ lệ
trùng khớp tuyệt đối và lệch không quá 1 mức, bảng nhầm lẫn, các cặp lệch ≥ 2.

Chưa chấm đủ 30 cặp thì báo cáo là kiểm tra sơ bộ: chỉ tỷ lệ trùng và từng cặp,
không tính kappa (dưới `MIN_PAIRS_FOR_KAPPA` cặp thì kappa không có ý nghĩa).

Chạy: ml/.venv/bin/python ml/scripts/agreement.py → ml/reports/label_agreement.md
"""

import json

import openpyxl
from paths import GOLD_SHEET, LABELING_DIR, REPORTS_DIR
from sklearn.metrics import cohen_kappa_score

CLAUDE_SHEET = LABELING_DIR / 'gold_pairs_claude.xlsx'
AUDIT_FILE = LABELING_DIR / 'audit_pairs.json'
KAPPA_TARGET = 0.70
MIN_PAIRS_FOR_KAPPA = 10


def labels(path, sheet='Chấm'):
    rows = openpyxl.load_workbook(path, read_only=True)[sheet].iter_rows(min_row=2, values_only=True)
    return {row[0]: row for row in rows if row[0] is not None}


def preliminary(pairs, planned, human, claude):
    """Báo cáo khi người mới chấm ít cặp: tỷ lệ trùng và từng cặp, không có kappa."""
    exact = sum(a == b for _, a, b in pairs)
    near = sum(abs(a - b) <= 1 for _, a, b in pairs)
    lines = [
        '# Kiểm tra sơ bộ nhãn người – Claude',
        '',
        f'Người làm đồ án chấm mù {len(pairs)}/{planned} cặp kiểm chứng dự kiến. Chưa đủ để tính',
        f'kappa (cần từ {MIN_PAIRS_FOR_KAPPA} cặp), nên đây chỉ là kiểm tra sơ bộ: trùng tuyệt đối',
        f'{exact}/{len(pairs)}, lệch không quá 1 mức {near}/{len(pairs)}. Tạo bằng `ml/scripts/agreement.py`.',
        '',
        '| Cặp | Tin | CV | Người | Claude | Lý do của người | Lý do của Claude |',
        '| --- | --- | --- | ---: | ---: | --- | --- |',
    ]
    lines += [
        f'| #{stt} | {human[stt][1]} | {human[stt][3]} | {a} | {b} | {human[stt][6]} | {claude[stt][6]} |'
        for stt, a, b in pairs
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / 'label_agreement.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


def main():
    audit = json.loads(AUDIT_FILE.read_text(encoding='utf-8'))['stt']
    human, claude = labels(GOLD_SHEET), labels(CLAUDE_SHEET)
    pairs = [(stt, human[stt][4], claude[stt][4]) for stt in audit if human[stt][4] is not None]
    if len(pairs) < MIN_PAIRS_FOR_KAPPA:
        return preliminary(pairs, len(audit), human, claude)
    ours, theirs = [p[1] for p in pairs], [p[2] for p in pairs]
    kappa = cohen_kappa_score(ours, theirs, weights='quadratic', labels=[0, 1, 2, 3, 4])
    exact = sum(a == b for a, b in zip(ours, theirs, strict=True)) / len(pairs)
    near = sum(abs(a - b) <= 1 for a, b in zip(ours, theirs, strict=True)) / len(pairs)
    lines = [
        f'# Độ đồng thuận nhãn người – Claude ({len(pairs)}/{len(audit)} cặp kiểm chứng)',
        '',
        f'Quadratic weighted kappa: **{kappa:.3f}** (ngưỡng {KAPPA_TARGET}). Trùng tuyệt đối {exact:.0%},',
        f'lệch không quá 1 mức {near:.0%}. Tạo bằng `ml/scripts/agreement.py`.',
        '',
        'Bảng nhầm lẫn (hàng: người, cột: Claude):',
        '',
        '| | 0 | 1 | 2 | 3 | 4 |',
        '| --- | ---: | ---: | ---: | ---: | ---: |',
    ]
    for level in range(5):
        counts = [sum(1 for a, b in zip(ours, theirs, strict=True) if a == level and b == other) for other in range(5)]
        lines.append(f'| {level} | ' + ' | '.join(map(str, counts)) + ' |')
    far = [(stt, a, b) for stt, a, b in pairs if abs(a - b) >= 2]
    lines += ['', f'Cặp lệch từ 2 mức ({len(far)}):', '']
    lines += [f'- #{stt} ({human[stt][1]}, {human[stt][3]}): người {a}, Claude {b}' for stt, a, b in far] or ['- không có']
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / 'label_agreement.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
