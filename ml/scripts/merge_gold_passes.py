"""Gộp hai lượt gán nhãn độc lập của đợt 2 tập vàng thành phiếu nhãn cuối.

Đợt 2 (150 cặp, 20/11/2026) được hai người gán độc lập (đều là Claude, mỗi người
một phiên riêng, chỉ đọc rubric cùng nội dung tin và CV) chấm theo
`ml/labeling/rubric.md`. Cặp hai lượt trùng nhau thì lấy nhãn đó; cặp lệch nhau do
một lượt phân xử thứ ba (cũng là Claude) quyết định sau khi đọc lại cặp và lý do của cả hai.

Đầu vào `ml/labeling/gold_pairs_2_passes.json`:
    {"passes": {"A": [{stt, jd_id, cv_id, label, confidence, reason}, …], "B": […]},
     "adjudication": [{stt, label, reason}, …]}

Chạy: ml/.venv/bin/python ml/scripts/merge_gold_passes.py
- Còn cặp lệch chưa phân xử: in danh sách và dừng.
- Đủ rồi: ghi `ml/labeling/gold_pairs_claude_2.xlsx` (cùng cột với đợt 1, thêm nhãn
  của từng lượt) và `ml/reports/gold_batch2_agreement.md` (độ đồng thuận giữa hai lượt).
"""

import json
import sys
from collections import Counter
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Font
from paths import GOLD_CLAUDE_SHEETS, GOLD_SHEET_2, LABELING_DIR, REPORTS_DIR
from agreement import labels
from sklearn.metrics import cohen_kappa_score

PASSES = LABELING_DIR / 'gold_pairs_2_passes.json'
HEADER = ['stt', 'jd_id', 'jd_title', 'cv_id', 'label', 'confidence', 'reason', 'labeled_at', 'annotator', 'label_a', 'label_b']  # fmt: skip
WIDTHS = (5, 8, 50, 8, 7, 12, 90, 12, 10, 8, 8)


def agreement_report(first, second, decided):
    a = [row['label'] for row in first]
    b = [row['label'] for row in second]
    exact = sum(x == y for x, y in zip(a, b, strict=True))
    near = sum(abs(x - y) <= 1 for x, y in zip(a, b, strict=True))
    kappa = cohen_kappa_score(a, b, weights='quadratic', labels=[0, 1, 2, 3, 4])
    confusion = Counter(zip(a, b, strict=True))
    final = Counter(decided.values())
    lines = [
        '# Đợt 2 tập vàng: độ đồng thuận giữa hai lượt gán nhãn',
        '',
        f'{len(a)} cặp (15 tin × 10 CV), hai lượt gán độc lập, cùng là Claude và cùng rubric',
        '(`ml/labeling/rubric.md`), mỗi lượt chỉ đọc nội dung tin và CV. Đây là độ nhất quán',
        'của một kiểu người gán với chính nó, không thay cho kiểm chứng của người.',
        'Tạo bằng `ml/scripts/merge_gold_passes.py`.',
        '',
        f'- Trùng tuyệt đối: {exact}/{len(a)} ({exact / len(a):.0%}).',
        f'- Lệch không quá 1 mức: {near}/{len(a)} ({near / len(a):.0%}).',
        f'- Kappa có trọng số bậc hai: {kappa:.3f}'.replace('.', ',', 1) + '.',
        f'- {len(a) - exact} cặp lệch do một lượt phân xử thứ ba (cũng là Claude) quyết định sau khi đọc lại cặp và lý do của hai lượt.',
        '',
        '## Bảng nhầm lẫn (hàng: lượt A, cột: lượt B)',
        '',
        '| A \\ B | 0 | 1 | 2 | 3 | 4 |',
        '| --- | ---: | ---: | ---: | ---: | ---: |',
    ]
    lines += [f'| {x} | ' + ' | '.join(str(confusion[(x, y)]) for y in range(5)) + ' |' for x in range(5)]
    lines += [
        '',
        '## Nhãn cuối',
        '',
        'Số cặp theo nhãn 0–4: ' + ', '.join(str(final[label]) for label in range(5)) + '.',
    ]
    return '\n'.join(lines) + '\n'


def main():
    data = json.loads(PASSES.read_text(encoding='utf-8'))
    first = sorted(data['passes']['A'], key=lambda row: row['stt'])
    second = sorted(data['passes']['B'], key=lambda row: row['stt'])
    if [row['stt'] for row in first] != [row['stt'] for row in second]:
        sys.exit('Hai lượt không cùng danh sách cặp.')
    rulings = {row['stt']: row for row in data.get('adjudication', [])}
    pending = [a['stt'] for a, b in zip(first, second, strict=True) if a['label'] != b['label'] and a['stt'] not in rulings]  # fmt: skip
    if pending:
        sys.exit(f'Còn {len(pending)} cặp lệch chưa phân xử: {pending}')

    titles = {row[0]: row[2] for row in labels(GOLD_SHEET_2).values()}
    book = Workbook()
    sheet = book.active
    sheet.title = 'Chấm'
    sheet.append(HEADER)
    decided, today = {}, date.today().isoformat()
    for a, b in zip(first, second, strict=True):
        ruling = rulings.get(a['stt']) if a['label'] != b['label'] else None
        label = ruling['label'] if ruling else a['label']
        reason = f'Phân xử (A={a["label"]}, B={b["label"]}): {ruling["reason"]}' if ruling else a['reason']
        decided[a['stt']] = label
        sheet.append([a['stt'], a['jd_id'], titles[a['stt']], a['cv_id'], label, 'chắc', reason, today, 'claude', a['label'], b['label']])  # fmt: skip
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for column, width in zip('ABCDEFGHIJK', WIDTHS, strict=True):
        sheet.column_dimensions[column].width = width
    sheet.freeze_panes = 'A2'
    book.save(GOLD_CLAUDE_SHEETS[1])
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report = agreement_report(first, second, decided)
    (REPORTS_DIR / 'gold_batch2_agreement.md').write_text(report, encoding='utf-8')
    print(report)


if __name__ == '__main__':
    main()
