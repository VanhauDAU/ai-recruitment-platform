"""Cổng chất lượng cho kho CV huấn luyện sinh bằng mô hình (kế hoạch bản 3, mục 3.2).

    ml/.venv/bin/python ml/scripts/quality_gate.py

Mỗi CV trong `ml/data/cv/train/` phải qua hết các kiểm tra dưới đây; không qua thì bị
loại khỏi dữ liệu huấn luyện (không sửa tay):

- chữ cái thuộc hệ Latin (Qwen đôi khi chuyển sang chữ Trung, chữ Nga);
- ô ngắn (chức danh, tên công ty, tên bằng) không bị viết thành cả đoạn;
- tên bằng nói đúng bậc học script đã chọn (`degree_level`);
- ngày tháng các việc đúng số tháng script đã chọn;
- phần chữ nhắc tên ít nhất một nửa số kỹ năng script đã chọn;
- CV "vị trí gần" không chứa quá nửa kỹ năng cần có của tin neo (không thì thực
  chất là CV khớp, nhãn yếu sai);
- không gần trùng một CV khác của cùng tin neo (Jaccard từ ≥ 0,6);
- đã được bổ sung mục ngoại ngữ và các mục phụ (`enrich_cvs.py --train`).

Kết quả: `ml/data/cv/train/gate.json` ({mã CV: [lý do bị loại]}, rỗng là qua) và
`ml/reports/train_cv_gate.md`. Kèm `ml/labeling/train_cv_review.md`: 40 CV chọn
ngẫu nhiên trong số CV qua cổng để người làm đồ án đọc bằng mắt và ghi tỷ lệ lỗi.
"""

import json
import random
import re
from collections import Counter, defaultdict

from corpus import cv_text
from generate_cvs import degree_level_of, has_foreign_script, has_runaway_text, load_jobs, words
from paths import LABELING_DIR, REPORTS_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST

REVIEW_SAMPLE = 40
NEAR_DUPLICATE = 0.6
MIN_SKILLS_IN_TEXT = 0.5
MAX_ADJACENT_REQUIRED_SHARE = 0.5
MONTH_TOLERANCE = 1


def months_of(data):
    total = 0
    for job in data.get('experience', []):
        start = job.get('start_date')
        if not start:
            continue
        end = job.get('end_date') or '2026-10'
        (y1, m1), (y2, m2) = (map(int, start.split('-')), map(int, end.split('-')))
        total += (y2 * 12 + m2) - (y1 * 12 + m1) + 1
    return total


def problems_of(data, facts, job):
    found = []
    if 'languages' not in data:
        found.append('chưa bổ sung ngoại ngữ và mục phụ')
    if has_foreign_script(data):
        found.append('chữ ngoài hệ Latin')
    if has_runaway_text(data):
        found.append('ô ngắn bị viết thành đoạn')
    if degree_level_of((data.get('education') or {}).get('degree', '')) != facts['education_level']:
        found.append('tên bằng lệch bậc học')
    if abs(months_of(data) - facts['experience_months']) > MONTH_TOLERANCE:
        found.append('ngày tháng lệch số tháng kinh nghiệm')
    if facts.get('skills_in_text', 1) < MIN_SKILLS_IN_TEXT:
        found.append('phần chữ thiếu kỹ năng đã chọn')
    if facts['intended_match'] == 'adjacent' and job['required']:
        shared = len({name.casefold() for name in facts['skills']} & {name.casefold() for name in job['required']})
        if shared / len(job['required']) > MAX_ADJACENT_REQUIRED_SHARE:
            found.append('CV vị trí gần có quá nửa kỹ năng của tin neo')
    return found


def main():
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    jobs = {job['code']: job for job in load_jobs()}
    data = {code: json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8')) for code in manifest}
    gate = {code: problems_of(data[code], facts, jobs[facts['anchor_job']]) for code, facts in manifest.items()}

    by_anchor = defaultdict(list)
    for code, facts in manifest.items():
        by_anchor[facts['anchor_job']].append(code)
    for codes in by_anchor.values():
        bags = {code: words(data[code]) for code in codes}
        for index, code in enumerate(codes):
            for other in codes[:index]:
                if not gate[other] and len(bags[code] & bags[other]) / max(1, len(bags[code] | bags[other])) >= NEAR_DUPLICATE:
                    gate[code].append(f'gần trùng {other}')
                    break

    TRAIN_CV_DIR.joinpath('gate.json').write_text(json.dumps(gate, ensure_ascii=False, indent=1), encoding='utf-8')
    passed = [code for code, found in gate.items() if not found]
    reasons = Counter(re.sub(r' TR-\d+$', '', reason) for found in gate.values() for reason in found)
    levels = Counter(manifest[code]['intended_match'] for code in passed)
    lines = [
        '# Cổng chất lượng kho CV huấn luyện',
        '',
        f'{len(manifest)} CV sinh bằng `{next(iter(manifest.values()))["model"]}` cho '
        f'{len(by_anchor)} tin ngoài tập vàng; {len(passed)} CV qua cổng '
        f'({len(passed) / len(manifest):.0%}). Tạo bằng `ml/scripts/quality_gate.py`.',
        '',
        'CV qua cổng theo mức khớp dự kiến: ' + ', '.join(f'{name} {count}' for name, count in levels.most_common()) + '.',
        '',
        '| Lý do bị loại | Số CV |',
        '| --- | ---: |',
        *[f'| {reason} | {count} |' for reason, count in reasons.most_common()],
    ]
    REPORTS_DIR.joinpath('train_cv_gate.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    sample = sorted(random.Random(2026).sample(passed, min(REVIEW_SAMPLE, len(passed))))
    review = [
        '# Đọc kiểm 40 CV huấn luyện',
        '',
        'Chọn ngẫu nhiên trong số CV đã qua `quality_gate.py`. Với mỗi CV, đánh dấu một ô',
        'và ghi lỗi nếu có (bịa số liệu vô lý, sai nghề so với chức danh, câu vô nghĩa, lặp',
        'ý, lời thoại của mô hình…). Tỷ lệ lỗi được ghi vào báo cáo.',
        '',
    ]
    for code in sample:
        facts = manifest[code]
        review += [
            f'## {code}: {facts["role_written"]} ({facts["intended_match"]}, {facts["experience_months"]} tháng)',
            '',
            '- [ ] Ổn   - [ ] Có lỗi: ',
            '',
            '```text',
            cv_text(data[code]),
            '```',
            '',
        ]
    LABELING_DIR.joinpath('train_cv_review.md').write_text('\n'.join(review), encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
