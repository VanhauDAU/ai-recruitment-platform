"""Độ đồng thuận giữa nhãn của Claude và nhãn người làm đồ án chấm mù (50 cặp kiểm chứng).

Đầu vào:
- nhãn của Claude: `gold_pairs_claude.xlsx` (đợt 1) và `gold_pairs_claude_2.xlsx` (đợt 2);
- cặp kiểm chứng: `audit_pairs.json` (30 cặp đợt 1 rút ngẫu nhiên + 20 cặp đợt 2 rút
  phân tầng theo nhãn, xem `build_audit_page.py`);
- nhãn của người: `audit_human.json` xuất từ trang chấm mù `audit_blind.html`. Cặp đã
  có nhãn ở cột `label` của `gold_pairs.xlsx` (5 cặp chấm ngày 18/11) giữ nhãn của lượt
  đó: báo cáo đồng thuận của 5 cặp này đã có từ 18/11, nên nhãn chấm lại sau đó không
  còn là nhãn mù (rubric: không sửa nhãn sau khi đã xem kết quả).

Đo: quadratic weighted kappa (thước đo chính của rubric, ngưỡng ≥ 0,70), tỷ lệ
trùng khớp tuyệt đối và lệch không quá 1 mức, bảng nhầm lẫn, các cặp lệch ≥ 2.

Chưa chấm đủ thì báo cáo là kiểm tra sơ bộ: chỉ tỷ lệ trùng và từng cặp, không tính
kappa (dưới `MIN_PAIRS_FOR_KAPPA` cặp thì kappa không có ý nghĩa).

Chạy: ml/.venv/bin/python ml/scripts/agreement.py → ml/reports/label_agreement.md
"""

import json

import openpyxl
from paths import AUDIT_HUMAN, AUDIT_PAIRS, GOLD_CLAUDE_SHEETS, GOLD_SHEET, REPORTS_DIR
from sklearn.metrics import cohen_kappa_score

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


def audit_numbers():
    audit = json.loads(AUDIT_PAIRS.read_text(encoding='utf-8'))
    return audit['stt'] + audit.get('extension', {}).get('stt', [])


def human_note():
    """Ghi chú về cách người chấm làm (khóa `human_pass` của `audit_pairs.json`)."""
    return json.loads(AUDIT_PAIRS.read_text(encoding='utf-8')).get('human_pass', {}).get('note', '')


def human_labels(claude):
    """Nhãn của người theo số thứ tự cặp, cùng dạng dòng với phiếu chấm (nhãn ở cột 4, lý do ở cột 6)."""
    rows = {stt: row for stt, row in labels(GOLD_SHEET).items() if row[4] is not None}
    if AUDIT_HUMAN.exists():
        for item in json.loads(AUDIT_HUMAN.read_text(encoding='utf-8'))['pairs']:
            stt = item['stt']
            if stt in rows:
                continue  # đã chấm ở lượt đầu (18/11): giữ nhãn mù của lượt đó
            if (item['jd'], item['cv']) != (claude[stt][1], claude[stt][3]):
                raise SystemExit(f'audit_human.json: cặp #{stt} không khớp mã tin/CV của tập vàng.')
            rows[stt] = (stt, item['jd'], '', item['cv'], int(item['label']), item.get('confidence'), item.get('reason', ''))
    return rows


def main():
    audit = audit_numbers()
    claude = {stt: row for sheet in GOLD_CLAUDE_SHEETS for stt, row in labels(sheet).items()}
    human = human_labels(claude)
    pairs = [(stt, human[stt][4], claude[stt][4]) for stt in audit if stt in human]
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
        'Cặp kiểm chứng không rút hoàn toàn ngẫu nhiên: 20 cặp của đợt 2 được rút phân tầng theo nhãn',
        'của Claude để đủ các mức 3–4. Người chấm không biết nhãn, điểm hệ thống hay cách rút.',
        *(['', human_note()] if human_note() else []),
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
