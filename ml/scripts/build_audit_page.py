"""Trang chấm mù cho người làm đồ án: 50 cặp kiểm chứng, có bảng tiêu chí theo rubric.

    ml/.venv/bin/python ml/scripts/build_audit_page.py

Mở `ml/labeling/audit_blind.html` bằng trình duyệt (không cần mạng, không cần máy
chủ). Kết quả lưu trong trình duyệt và xuất ra `audit_human.json`; đặt tệp đó vào
`ml/labeling/` rồi chạy `agreement.py`.

50 cặp kiểm chứng (`ml/labeling/audit_pairs.json`):
- 30 cặp cũ của đợt 1 (2 cặp mỗi tin, rút ngẫu nhiên, seed 2026): giữ nguyên.
- 20 cặp thêm từ đợt 2 (khóa `extension`), rút **phân tầng theo nhãn của Claude**: 30
  cặp cũ gần như không có nhãn 3–4, mà kappa chỉ có nghĩa khi đủ mọi mức. Nhiều nhất
  hai cặp mỗi tin. Danh sách đã ghi thì không rút lại.

Giữ mù:
- trang chỉ chứa nội dung tin và CV; không có nhãn của Claude, điểm của hệ thống,
  nguồn ghép cặp, phần validation/test, hay mức khớp dự kiến của CV tổng hợp;
- script đọc nhãn của Claude chỉ để rút phân tầng, không ghi nhãn ra đâu cả;
- các cặp cùng một tin đứng liền nhau (rubric: chấm hết CV của một tin rồi mới sang
  tin khác), thứ tự tin và thứ tự CV trong tin được xáo.

Bảng tiêu chí trên trang (vị trí, từng kỹ năng cần có, kinh nghiệm, cấp bậc, điểm trừ)
là các bước của `rubric.md`; mức "gợi ý theo rubric" tính từ chính các ô người chấm
đánh dấu. Điểm cuối cùng do người chấm chọn, và tệp xuất ghi cả hai.
"""

import json
import random
from collections import defaultdict

import openpyxl
from agreement import labels
from paths import (
    AUDIT_PAGE,
    AUDIT_PAIRS,
    AUDIT_TEMPLATE,
    GOLD_CLAUDE_SHEETS,
    GOLD_SHEET,
    JD_INPUT,
    SYNTHETIC_CV_DIR,
)

SEED = 2026
# Số cặp thêm theo nhãn của Claude ở đợt 2 (đợt 2 chỉ có 4 cặp nhãn 3).
EXTENSION_BY_LABEL = {0: 3, 1: 3, 2: 4, 3: 4, 4: 6}
MAX_PER_JD = 2
VERSION = 'v1-50'
# Trường của CV tổng hợp không hiện cho người chấm: `degree_level` hay lệch với tên
# bằng (rubric E2: chấm theo chữ ghi ở tên bằng).
HIDDEN_CV_KEYS = ('degree_level',)


def extension(batch):
    """20 cặp của đợt 2, rút phân tầng theo nhãn; hết chỗ theo tin thì nới giới hạn."""
    rng = random.Random(SEED)
    per_jd, chosen = defaultdict(int), []
    for label, count in EXTENSION_BY_LABEL.items():
        rows = sorted(stt for stt, row in batch.items() if row[4] == label)
        rng.shuffle(rows)
        spread = [stt for stt in rows if per_jd[batch[stt][1]] < MAX_PER_JD]
        for stt in (spread + [stt for stt in rows if stt not in spread])[:count]:
            per_jd[batch[stt][1]] += 1
            chosen.append(stt)
    return sorted(chosen)


def audit_numbers():
    """Số thứ tự 50 cặp kiểm chứng; ghi phần thêm vào `audit_pairs.json` ở lần đầu."""
    audit = json.loads(AUDIT_PAIRS.read_text(encoding='utf-8'))
    if 'extension' not in audit:
        audit['extension'] = {
            'seed': SEED,
            'method': 'đợt 2, phân tầng theo nhãn của Claude, nhiều nhất 2 cặp mỗi tin',
            'stt': extension(labels(GOLD_CLAUDE_SHEETS[1])),
        }
        AUDIT_PAIRS.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return audit['stt'] + audit['extension']['stt']


def text(value):
    return '' if value is None else str(value).strip()


def names(value):
    return [name.strip() for name in text(value).split(';') if name.strip()]


def job_records(codes):
    """Nội dung tin như người đăng nhập, trừ những thứ rubric không xét (nơi làm việc, lương, công ty)."""
    rows = openpyxl.load_workbook(JD_INPUT, read_only=True, data_only=True)['JD'].iter_rows(values_only=True)
    header = [text(cell) for cell in next(rows)]
    jobs = {}
    for row in rows:
        record = dict(zip(header, row, strict=False))
        code = text(record.get('Mã tin'))
        if code not in codes:
            continue
        languages = [
            ' · '.join(
                filter(
                    None,
                    (
                        text(record.get(f'Ngoại ngữ {index}')),
                        text(record.get(f'Mức ngoại ngữ {index}')),
                        text(record.get(f'Chứng chỉ {index}')),
                        'bắt buộc' if text(record.get(f'Ngoại ngữ {index} bắt buộc')).casefold() in ('có', 'x', 'true', '1', 'yes') else '',
                    ),
                )
            )
            for index in (1, 2)
            if text(record.get(f'Ngoại ngữ {index}'))
        ]  # fmt: skip
        jobs[code] = {
            'code': code,
            'title': text(record.get('Tiêu đề tin')),
            'facts': [
                ['Vị trí chuyên môn', text(record.get('Vị trí chuyên môn'))],
                ['Cấp bậc', text(record.get('Cấp bậc'))],
                ['Kinh nghiệm', text(record.get('Kinh nghiệm yêu cầu'))],
                ['Học vấn', text(record.get('Học vấn yêu cầu'))],
                ['Ngoại ngữ', '; '.join(languages)],
            ],
            'level': text(record.get('Cấp bậc')),
            'experience': text(record.get('Kinh nghiệm yêu cầu')),
            'education': text(record.get('Học vấn yêu cầu')),
            'language_required': '; '.join(item for item in languages if 'bắt buộc' in item),
            'required': names(record.get('Kỹ năng cần có')),
            'preferred': names(record.get('Kỹ năng nên có')),
            'description': text(record.get('Mô tả công việc')),
            'requirements': text(record.get('Yêu cầu ứng viên')),
        }
    return jobs


def without_hidden(value):
    if isinstance(value, dict):
        return {key: without_hidden(item) for key, item in value.items() if key not in HIDDEN_CV_KEYS}
    if isinstance(value, list):
        return [without_hidden(item) for item in value]
    return value


def ordered(pairs):
    """Cặp cùng tin đứng liền nhau; thứ tự tin và thứ tự CV trong tin được xáo."""
    rng = random.Random(SEED)
    by_job = defaultdict(list)
    for pair in pairs:
        by_job[pair['jd']].append(pair)
    jobs = sorted(by_job)
    rng.shuffle(jobs)
    result = []
    for job in jobs:
        rng.shuffle(by_job[job])
        result += by_job[job]
    return result


def main():
    claude = {stt: row for sheet in GOLD_CLAUDE_SHEETS for stt, row in labels(sheet).items()}
    # Chỉ lấy mã tin và mã CV từ phiếu; cột nhãn của Claude không đi tiếp.
    pairs = ordered([{'stt': stt, 'jd': claude[stt][1], 'cv': claude[stt][3]} for stt in audit_numbers()])
    jobs = job_records({pair['jd'] for pair in pairs})
    cvs = {
        pair['cv']: without_hidden(json.loads((SYNTHETIC_CV_DIR / f'{pair["cv"]}.json').read_text(encoding='utf-8')))
        for pair in pairs
    }
    wanted = {pair['stt'] for pair in pairs}
    prefilled = {
        str(stt): {'label': int(row[4]), 'confidence': text(row[5]) or 'chắc', 'reason': text(row[6]), 'labeled_at': text(row[7])}
        for stt, row in labels(GOLD_SHEET).items()
        if stt in wanted and row[4] is not None
    }  # fmt: skip
    data = {'version': VERSION, 'pairs': pairs, 'jobs': jobs, 'cvs': cvs, 'prefilled': prefilled}
    payload = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    page = AUDIT_TEMPLATE.read_text(encoding='utf-8').replace('/*__DATA__*/', payload)
    AUDIT_PAGE.write_text(page, encoding='utf-8')
    print(
        f'{AUDIT_PAGE}: {len(pairs)} cặp, {len(jobs)} tin, {len(cvs)} CV; '
        f'{len(prefilled)} cặp đã chấm trước được nạp sẵn.'
    )


if __name__ == '__main__':
    main()
