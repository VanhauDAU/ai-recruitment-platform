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

Ba kiểm tra thêm sau lượt đọc kiểm đầu (26/11, `train_cv_review_round1.md`):
- CV "vị trí gần" không được mang chính chức danh của tin neo: mô hình hay chép tên
  vị trí của tin thay vì viết nghề gần, làm nhãn yếu sai và hỏng bộ ba chức danh;
- không có hai gạch đầu dòng gần trùng nhau trong cùng một CV (mục dự án chép mục kinh nghiệm);
- không có chữ dính lẫn hai ngôn ngữ ("tăng cườngAwareness", "công nghệ.amiliar"), và
  CV tiếng Việt không có cụm tiếng Anh nằm giữa câu.

Lượt đọc kiểm thứ hai (`train_cv_review_round2.md`) chia lỗi nặng và lỗi nhẹ; sau lượt
này ngưỡng gạch đầu dòng gần trùng hạ từ 0,7 xuống 0,6, và ba mục do bước bổ sung viết
(Hoạt động, Giải thưởng, Sở thích) bị bỏ khỏi văn bản huấn luyện ở `build_train_pairs.py`
vì gần nửa số lỗi nặng nằm ở đó.

Kết quả: `ml/data/cv/train/gate.json` ({mã CV: [lý do bị loại]}, rỗng là qua) và
`ml/reports/train_cv_gate.md`. Kèm `ml/labeling/train_cv_review.md`: 40 CV chọn
ngẫu nhiên trong số CV qua cổng (trừ những CV đã đọc ở lượt trước) để người làm đồ án
đọc bằng mắt. Phiếu chia hai mức lỗi: lỗi nặng làm sai nghề hoặc sai mức khớp so với
tin, hoặc làm hỏng câu chữ; lỗi nhẹ là văn phong và số liệu phóng đại.
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
# Phần từ của chức danh CV nằm trong tên vị trí của tin neo, từ đó coi là cùng chức danh.
SAME_TITLE_SHARE = 0.75
_VIETNAMESE = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ'
# Chữ tiếng Việt dính liền một từ tiếng Anh viết hoa, hoặc dấu chấm dính chữ thường.
_GLUED = re.compile(rf'[{_VIETNAMESE}][a-z{_VIETNAMESE}]*[A-Z][a-z]|[{_VIETNAMESE}]\w*\.[a-z]{{3,}}')
# Hai gạch đầu dòng trùng từ chừng này trở lên là một ý viết hai lần.
REPEATED_LINE = 0.6
MIN_LINE_WORDS = 6
REVIEWED = LABELING_DIR / 'train_cv_review_round1.md'
REVIEWED_2 = LABELING_DIR / 'train_cv_review_round2.md'
# Trong CV tiếng Việt: một cụm tiếng Anh có hư từ nằm giữa câu ("Giao tiếp fluently in both English").
_ENGLISH_RUN = re.compile(r'\b[a-z]{2,} (?:and|the|of|with|for|both|from) [A-Za-z]{2,}\b')


def english_in_vietnamese(data):
    lines = [data.get('summary', '')]
    lines += [line for key in ('experience', 'projects') for item in data.get(key, []) for line in item.get('highlights', [])]
    return any(_ENGLISH_RUN.search(str(line)) for line in lines)


def role_of(title):
    """Tên vị trí trong tiêu đề tin, bỏ phần lương và quảng cáo sau dấu ngăn."""
    return re.split(r'[|(\[–—]| - | I ', title)[0]


def title_words(text):
    return set(re.findall(r'\w+', str(text).casefold()))


def same_title(headline, title):
    head = title_words(headline)
    return bool(head) and len(head & title_words(role_of(title))) / len(head) >= SAME_TITLE_SHARE


def repeated_bullets(data):
    """Có hai gạch đầu dòng gần như trùng nhau (mục dự án chép mục kinh nghiệm, các việc chép nhau)."""
    bags = [
        title_words(line)
        for section in ('experience', 'projects', 'activities')
        for item in data.get(section, [])
        for line in item.get('highlights', [])
    ]
    bags = [bag for bag in bags if len(bag) >= MIN_LINE_WORDS]
    return any(
        len(bag & other) / len(bag | other) >= REPEATED_LINE
        for index, bag in enumerate(bags)
        for other in bags[:index]
    )


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
    if facts['intended_match'] == 'adjacent' and same_title(data.get('headline', ''), job['title']):
        found.append('CV vị trí gần mang chức danh của tin neo')
    if repeated_bullets(data):
        found.append('gạch đầu dòng lặp ý')
    if _GLUED.search(cv_text(data)) or (facts['language'] == 'vi' and english_in_vietnamese(data)):
        found.append('chữ dính, lẫn hai ngôn ngữ')
    return found


SECTIONS = (
    ('Kinh nghiệm', 'experience', ('role', 'company')),
    ('Dự án', 'projects', ('name', 'role')),
    ('Hoạt động', 'activities', ('name', 'organization')),
)


def review_text(data):
    """CV có tên từng mục, để người đọc biết đoạn nào là kinh nghiệm, đoạn nào là dự án."""
    education = data.get('education') or {}
    lines = [data.get('headline', ''), data.get('summary', '')]
    for title, key, head in SECTIONS:
        for item in data.get(key, []):
            dates = f' ({item["start_date"]} – {item.get("end_date") or "nay"})' if item.get('start_date') else ''
            lines.append(f'[{title}] ' + ' – '.join(str(item.get(name, '')) for name in head) + dates)
            lines += [f'  • {line}' for line in item.get('highlights', [])]
    lines.append(f'[Học vấn] {education.get("degree", "")} – {education.get("institution", "")}')
    lines.append('[Kỹ năng] ' + ', '.join(skill['name'] for skill in data.get('skills', [])))
    for title, key in (('Chứng chỉ', 'certifications'), ('Giải thưởng', 'awards'), ('Sở thích', 'interests')):
        if data.get(key):
            lines.append(f'[{title}] ' + '; '.join(map(str, data[key])))
    languages = [' '.join(filter(None, (item['language'], item.get('level'), item.get('certificate')))) for item in data.get('languages', [])]  # fmt: skip
    if languages:
        lines.append('[Ngoại ngữ] ' + '; '.join(languages))
    return '\n'.join(line for line in lines if str(line).strip())


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
    if REVIEWED.exists():
        # Lượt đọc kiểm đầu được làm trên kho trước khi có ba kiểm tra thêm.
        marks = re.findall(r'^## (TR-[\d-]+):.*\n\n- \[(.)\] Ổn   - \[(.)\] Có lỗi', REVIEWED.read_text(encoding='utf-8'), re.M)
        flagged = [code for code, _, error in marks if error.strip()]
        caught = [code for code in flagged if gate.get(code)]
        lines += [
            '',
            '## Đọc kiểm bằng mắt, lượt 1',
            '',
            f'Người làm đồ án đọc {len(marks)} CV rút ngẫu nhiên từ kho đã qua cổng lúc đó và ghi mọi lỗi nhìn thấy, kể cả',
            f'lỗi văn phong: {len(flagged)} CV có ít nhất một lỗi ({len(flagged) / max(1, len(marks)):.0%}), {len(marks) - len(flagged)} CV ổn',
            '(`ml/labeling/train_cv_review_round1.md`). Từ các lỗi này cổng được thêm ba kiểm tra (chức danh của CV',
            f'vị trí gần, gạch đầu dòng lặp, chữ dính); {len(caught)} trong {len(flagged)} CV có lỗi nay bị cổng loại. Các lỗi còn lại chủ',
            'yếu là số liệu phóng đại, tự nhận quá tầm, chứng chỉ và giải thưởng đáng ngờ: đặc điểm của CV do mô',
            'hình ngôn ngữ viết, cổng không lọc được.',
        ]
    if REVIEWED_2.exists():
        marks = re.findall(
            r'^## (TR-[\d-]+)\n(?:.*\n)*?- \[(.)\] Ổn\s+- \[(.)\] Lỗi nhẹ\s+- \[(.)\] Lỗi nặng',
            REVIEWED_2.read_text(encoding='utf-8'), re.M,
        )  # fmt: skip
        severe = [code for code, _, _, mark in marks if mark.strip()]
        minor = [code for code, _, mark, heavy in marks if mark.strip() and not heavy.strip()]
        caught = [code for code in severe if gate.get(code)]
        lines += [
            '',
            '## Đọc kiểm bằng mắt, lượt 2',
            '',
            f'Đọc {len(marks)} CV khác, rút từ kho sau ba kiểm tra thêm, chia hai mức lỗi: {len(severe)} CV lỗi nặng',
            f'({len(severe) / max(1, len(marks)):.1%}), {len(minor)} CV lỗi nhẹ, {len(marks) - len(severe) - len(minor)} CV ổn',
            '(`ml/labeling/train_cv_review_round2.md`). Lỗi nặng theo ghi chú của người đọc: lẫn ngôn ngữ hoặc',
            'chữ hỏng (7 CV, trong đó 4 CV chỉ hỏng ở mục Hoạt động, Giải thưởng, Sở thích), lặp ý giữa các việc',
            '(2 CV), sai mức khớp hoặc nội dung trái nghề (2 CV). Xử lý: bỏ ba mục phụ khỏi văn bản huấn luyện,',
            f'hạ ngưỡng lặp, thêm kiểm tra cụm tiếng Anh giữa câu tiếng Việt; {len(caught)} trong {len(severe)} CV lỗi nặng nay bị',
            'cổng loại. Phần còn lại (chữ hỏng không theo mẫu, chức danh vô nghĩa, sai mức khớp) cổng không bắt',
            'được; ước khoảng 15% CV của kho còn lỗi nặng, trong đó khoảng 5% là sai nhãn yếu.',
        ]
    REPORTS_DIR.joinpath('train_cv_gate.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    seen = {
        code
        for path in (REVIEWED, REVIEWED_2)
        if path.exists()
        for code in re.findall(r'^## (TR-[\d-]+)', path.read_text(encoding='utf-8'), re.M)
    }
    fresh = [code for code in passed if code not in seen]
    sample = sorted(random.Random(2027).sample(fresh, min(REVIEW_SAMPLE, len(fresh))))
    meaning = {
        'strong': 'khớp mạnh: đúng nghề của tin, đủ kỹ năng và kinh nghiệm',
        'partial': 'khớp một phần: đúng nghề của tin nhưng thiếu kỹ năng hoặc kinh nghiệm',
        'adjacent': 'vị trí gần: nghề khác nhưng cùng mảng với tin',
    }
    review = [
        '# Đọc kiểm 40 CV huấn luyện (lượt kế tiếp)',
        '',
        'Chọn ngẫu nhiên trong số CV đã qua `quality_gate.py`, trừ những CV đã đọc ở các lượt trước.',
        'Mỗi CV kèm tên vị trí của tin mà nó được viết cho và mức khớp máy định sẵn. Đánh dấu một ô:',
        '',
        '- **Lỗi nặng:** nghề hoặc mức khớp không đúng như dòng "Máy định viết"; câu chữ hỏng',
        '  (dính chữ, lẫn ngôn ngữ, vô nghĩa); nội dung lặp lại; lời thoại của mô hình.',
        '- **Lỗi nhẹ:** số liệu phóng đại, tự nhận quá tầm, chứng chỉ hay giải thưởng đáng ngờ,',
        '  dùng từ vụng. CV vẫn đúng nghề và đúng mức khớp.',
        '- **Ổn:** không thuộc hai loại trên.',
        '',
        'Lưu ý: CV chưa có kinh nghiệm (0 tháng) vẫn có thể có mục [Dự án]; đó không phải mâu thuẫn.',
        '',
    ]
    for code in sample:
        facts = manifest[code]
        review += [
            f'## {code}',
            '',
            f'- Tin: {role_of(jobs[facts["anchor_job"]]["title"]).strip()}',
            f'- Máy định viết: nghề "{facts["role_written"]}", {meaning[facts["intended_match"]]}, '
            f'{facts["experience_months"]} tháng kinh nghiệm',
            '',
            '- [ ] Ổn   - [ ] Lỗi nhẹ   - [ ] Lỗi nặng: ',
            '',
            '```text',
            review_text(data[code]),
            '```',
            '',
        ]
    LABELING_DIR.joinpath('train_cv_review.md').write_text('\n'.join(review), encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
