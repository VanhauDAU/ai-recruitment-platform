"""Đối chiếu `profile_json` đã xuất với đáp án của kho CV tổng hợp.

Đáp án: `manifest.json` (kỹ năng, số tháng kinh nghiệm, bậc học, ngoại ngữ do
script sinh CV quyết định) và nội dung JSON gốc của từng CV.

Đo cho từng nguồn (CV builder, CV tải lên, PDF hệ thống, PDF TopCV):
- recall kỹ năng: kỹ năng của manifest có trong hồ sơ;
- kỹ năng khai báo ngoài manifest (nghi nhận nhầm);
- số tháng kinh nghiệm lệch ≤ 3 tháng; bậc học đúng; ngôn ngữ đúng;
- không bịa: mọi `evidence` phải là chuỗi con của nội dung CV (JSON gốc với CV
  builder, chữ đọc từ chính tệp PDF với CV tải lên).

Chạy sau `export_profiles.py`: ml/.venv/bin/python ml/scripts/check_profiles.py
Kết quả: ml/reports/check_profiles.md
"""

import json
import re
import statistics
from datetime import date
import unicodedata

from corpus import cv_text
from extract_check import read_in_reading_order
from paths import (
    CV_MANIFEST,
    CV_PDF_SYSTEM_DIR,
    CV_PDF_TOPCV_DIR,
    JD_IMPORT_MAP,
    LABELING_DIR,
    PROFILES_DIR,
    REPORTS_DIR,
    SYNTHETIC_CV_DIR,
)

LANGUAGE_CODES = {
    'Tiếng Anh': 'en',
    'Tiếng Nhật': 'ja',
    'Tiếng Hàn': 'ko',
    'Tiếng Trung': 'zh',
    'Tiếng Pháp': 'fr',
    'Tiếng Việt': 'vi',
}
LANGUAGE_NAMES = {
    'en': ('Tiếng Anh', 'English'),
    'vi': ('Tiếng Việt', 'Vietnamese'),
    'ja': ('Tiếng Nhật', 'Japanese'),
    'zh': ('Tiếng Trung', 'Chinese', 'Mandarin'),
    'ko': ('Tiếng Hàn', 'Korean'),
    'fr': ('Tiếng Pháp', 'French'),
}
MONTH_TOLERANCE = 3
EDUCATION_KEY = json.loads((LABELING_DIR / 'education_key.json').read_text(encoding='utf-8'))['levels']


def squash(text):
    """Chữ và số theo đúng thứ tự, bỏ dấu câu và khoảng trắng thừa.

    Bằng chứng như "Chức danh — Công ty" ghép từ các trường của CV vẫn khớp với
    "Chức danh - Công ty" của văn bản gốc; một câu bịa hay ghép lẫn hai cột thì không.
    """
    text = unicodedata.normalize('NFC', str(text)).casefold()
    return ' '.join(re.findall(r'[^\W_]+', text))


def load(name):
    path = PROFILES_DIR / f'{name}.jsonl'
    return [json.loads(line) for line in path.open(encoding='utf-8')]


def month_index(value):
    year, month = (int(part) for part in value.split('-'))
    return year * 12 + month - 1


MONTH_ABBREVIATIONS = ('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec')


def date_is_printed(value, source):
    """Mốc `YYYY-MM` có in trong tài liệu dưới một trong các cách ghi mẫu CV dùng."""
    year, month = value.split('-')
    spellings = (f'{month} {year}', f'{year} {month}', f'{MONTH_ABBREVIATIONS[int(month) - 1]} {year}')
    return any(spelling in source for spelling in spellings)


def printed_months(data, source):
    """Số tháng kinh nghiệm của các việc thật sự in trong tài liệu.

    Bản PDF TopCV bị rơi việc đang làm (không có ngày kết thúc) khi tạo trên
    TopCV, nên đáp án của PDF chỉ tính các việc có ngày bắt đầu in trong tệp.
    (Tên công ty không dùng được: hai việc có thể cùng một công ty.)
    """
    today = date.today()
    now = today.year * 12 + today.month - 1
    ranges = sorted(
        (month_index(job['start_date']), month_index(job['end_date']) if job.get('end_date') else now)
        for job in data.get('experience', [])
        if job.get('start_date') and date_is_printed(job['start_date'], source)
    )
    total, current = 0, None
    for start, end in ranges:
        if current and start <= current[1] + 1:
            current = (current[0], max(current[1], end))
            continue
        if current:
            total += current[1] - current[0] + 1
        current = (start, end)
    return total + (current[1] - current[0] + 1 if current else 0)


def canonical_names():
    """Tên/alias → tên chuẩn của danh mục, để "Kotlin" và "Android (Kotlin)" là một kỹ năng."""
    return {squash(term): squash(row['name']) for row in load('skills') for term in row['terms']}


CANONICAL = {}


def canonical(name):
    return CANONICAL.get(squash(name), squash(name))


def compare(code, profile, manifest, pdf=None):
    facts = manifest[code]
    data = json.loads((SYNTHETIC_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))
    source = squash(cv_text(data) if pdf is None else read_in_reading_order(pdf))
    expected_months = facts['experience_months'] if pdf is None else printed_months(data, source)
    # PDF: chỉ tính kỹ năng và ngoại ngữ thật sự in trong tệp (mẫu CV có thể bỏ cả mục).
    printed = lambda name: pdf is None or squash(name) in source  # noqa: E731
    expected = {canonical(name) for name in facts['skills'] if printed(name)}
    found = {canonical(skill['name']) for skill in profile['skills']}
    declared = {canonical(skill['name']) for skill in profile['skills'] if skill['source'] == 'declared'}
    listed = {canonical(skill['name']) for skill in profile['skills'] if skill['source'] == 'listed'}
    evidences = [skill['evidence'] for skill in profile['skills'] if skill['evidence']]
    evidences += [item['evidence'] for item in profile['languages'] if item.get('evidence')]
    months = profile['experience']['months']
    # CV builder có trường bậc học do người dùng chọn; PDF chỉ có chữ in trên trang.
    education = facts['education_level'] if pdf is None else EDUCATION_KEY[code]
    # Mẫu CV có thể chỉ in tên trường mà bỏ tên bằng: khi đó không có gì để đọc bậc học.
    if pdf is not None and squash((data.get('education') or {}).get('degree', '')) not in source:
        education = None
    languages = {LANGUAGE_CODES.get(item['language'], '?') for item in facts.get('languages', [])}
    if pdf is not None:  # mẫu CV in tên ngôn ngữ theo tiếng của mẫu, không theo cách manifest ghi
        languages = {code for code in languages if any(squash(name) in source for name in LANGUAGE_NAMES.get(code, ()))}
    return {
        'code': code,
        'skill_recall': len(expected & found) / len(expected) if expected else None,
        'skills': (len(expected & found), len(expected), len(facts['skills']) - len(expected)),
        'skills_missed': sorted(expected - found),
        'title': (profile.get('title', ''), data.get('headline', '')),
        'title_ok': squash(profile.get('title', '')) == squash(data.get('headline', '')),
        'declared_extra': sorted(declared - expected),
        'listed_extra': sorted(listed - expected),
        'months_ok': months is not None and abs(months - expected_months) <= MONTH_TOLERANCE,
        'months': (months, expected_months),
        'basis': profile['experience'].get('basis', ''),
        'education_ok': education is None or profile['education']['level'] == education,
        'education': (profile['education']['level'], education),
        'languages_ok': {item['code'] for item in profile['languages']} == languages,
        'unsupported': [text for text in evidences if squash(text) not in source],
        'missing': profile['quality']['missing'],
    }


def summary(name, rows):
    def share(key):
        return sum(1 for row in rows if row[key]) / len(rows)

    found, expected, not_printed = (sum(row['skills'][index] for row in rows) for index in range(3))
    unsupported = sum(len(row['unsupported']) for row in rows)
    return (
        f'| {name} | {len(rows)} | {found / expected:.1%} ({found}/{expected}) | {not_printed} '
        f'| {sum(len(row["declared_extra"]) for row in rows)} | {share("months_ok"):.0%} '
        f'| {share("education_ok"):.0%} | {share("languages_ok"):.0%} '
        f'| {sum(row["title_ok"] for row in rows)}/{len(rows)} (có {sum(bool(row["title"][0]) for row in rows)}) '
        f'| {unsupported} |'
    )


def job_summary():
    """Hồ sơ tin: ngôn ngữ nhận diện so với ngôn ngữ ghi lúc nhập, đủ chunk yêu cầu."""
    imported = {row['job_public_id']: row for row in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).values()}
    rows = [row for row in load('jd') if row.get('job_public_id') in imported]
    profiles = [(imported[row['job_public_id']], row['profile']) for row in rows if 'profile' in row]
    wrong_language = [meta['title'][:50] for meta, profile in profiles if profile['language'] != meta['language']]
    without_requirements = [
        meta['title'][:50] for meta, profile in profiles if not any(c['section'] == 'requirement' for c in profile['chunks'])
    ]
    counted = [sum(1 for skill in profile['skills'] if skill['counted']) for _, profile in profiles]
    traits = sum(1 for _, profile in profiles for skill in profile['skills'] if not skill['counted'])
    missing = {}
    for _, profile in profiles:
        for name in profile['quality']['missing']:
            missing[name] = missing.get(name, 0) + 1
    return [
        '## Hồ sơ tin tuyển dụng',
        '',
        f'- {len(profiles)}/{len(rows)} tin trích xuất được; lỗi: {len(rows) - len(profiles)}.',
        f'- Ngôn ngữ nhận diện khác ngôn ngữ ghi lúc nhập: {len(wrong_language)} {wrong_language}.',
        f'- Tin không có chunk yêu cầu: {len(without_requirements)} {without_requirements}.',
        f'- Kỹ năng được đếm mỗi tin: trung bình {statistics.mean(counted):.2f}; '
        f'{traits} kỹ năng nhóm "Phẩm chất cá nhân" bị loại khỏi điểm.',
        f'- Chunk mỗi tin: trung bình {statistics.mean(p["quality"]["chunk_count"] for _, p in profiles):.1f}.',
        f'- Tiêu chí tin không khai: {missing or "không có"}.',
    ]


def main():
    CANONICAL.update(canonical_names())
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    groups = {
        'CV builder': [
            (row['code'], row['profile']) for row in load('cv') if row['cv_type'] == 'builder'
        ],
        # Đọc thẳng 15 tệp PDF hệ thống trên đĩa (`export_profiles.py` xuất `pdf_system`): bản
        # tải lên trong DB dev phụ thuộc kho tệp cục bộ, có thể không còn sau khi dựng lại.
        'CV tải lên (PDF hệ thống)': [
            (row['file'].removesuffix('.pdf'), row['profile'])
            for row in load('pdf_system')
            if 'profile' in row
        ],
        'PDF TopCV': [
            (row['file'].removesuffix('.pdf'), row['profile'])
            for row in load('pdf_topcv')
            if 'profile' in row
        ],
    }
    pdf_dirs = {'CV tải lên (PDF hệ thống)': CV_PDF_SYSTEM_DIR, 'PDF TopCV': CV_PDF_TOPCV_DIR}
    results = {
        name: [
            compare(code, profile, manifest, pdf_dirs[name] / f'{code}.pdf' if name in pdf_dirs else None)
            for code, profile in items
        ]
        for name, items in groups.items()
    }
    lines = [
        '# Kiểm tra trích xuất hồ sơ CV',
        '',
        'Đối chiếu `profile_json` với nhãn của `manifest.json` và nội dung JSON gốc.',
        f'Số tháng kinh nghiệm tính là đúng khi lệch ≤ {MONTH_TOLERANCE} tháng; với PDF, đáp án là',
        'số tháng của các việc thật sự in trong tệp (PDF TopCV bị rơi việc đang làm khi tạo).',
        'Học vấn: CV builder so với trường bậc học của CV; PDF so với bậc học theo đúng chữ in ở',
        'tên bằng (`ml/labeling/education_key.json`), vì trường `degree_level` của CV tổng hợp lệch',
        'với tên bằng ở 53/100 CV. Hai CV có tên bằng không nói rõ bậc không tính vào tỷ lệ.',
        '"Bằng chứng không có trong CV" phải bằng 0 (quy tắc không bịa).',
        'Tạo bằng `ml/scripts/check_profiles.py`.',
        '',
        'Kỹ năng và ngoại ngữ của PDF chỉ tính những mục thật sự in trong tệp: mẫu TopCV bỏ hẳn mục',
        'kỹ năng hoặc ngoại ngữ ở một số CV (cột "Kỹ năng không in trong tệp").',
        '',
        'Chức danh: số CV có chức danh trùng đúng headline của CV gốc; trong ngoặc là số CV có chức danh',
        '(chức danh khác headline thường là chức danh của việc gần nhất).',
        '',
        '| Nguồn | Số CV | Recall kỹ năng | Kỹ năng không in trong tệp | Kỹ năng khai báo ngoài manifest | Kinh nghiệm đúng | Học vấn đúng | Ngôn ngữ đúng | Chức danh | Bằng chứng không có trong CV |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    lines += [summary(name, rows) for name, rows in results.items()]
    for name, rows in results.items():
        wrong = [
            row
            for row in rows
            if not (row['months_ok'] and row['education_ok'] and row['languages_ok'])
            or row['unsupported']
            or row['skills_missed']
        ]
        if not wrong:
            continue
        lines += ['', f'## Lệch ở {name} ({len(wrong)} CV)', '']
        for row in wrong:
            notes = []
            if not row['months_ok']:
                notes.append(f'tháng {row["months"][0]} (đúng {row["months"][1]}, theo {row["basis"] or "—"})')
            if not row['education_ok']:
                notes.append(f'học vấn {row["education"][0] or "—"} (đúng {row["education"][1]})')
            if not row['languages_ok']:
                notes.append('ngôn ngữ lệch')
            if row['skills_missed']:
                notes.append('sót kỹ năng: ' + ', '.join(row['skills_missed']))
            if row['unsupported']:
                notes.append(f'{len(row["unsupported"])} bằng chứng không khớp CV gốc')
            lines.append(f'- `{row["code"]}`: ' + '; '.join(notes))
    lines += ['', *job_summary()]
    extras = sorted({skill for rows in results.values() for row in rows for skill in row['declared_extra']})
    lines += ['', 'Kỹ năng khai báo ngoài manifest (để rà nhận nhầm):', '', ', '.join(extras) or '—']
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / 'check_profiles.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
