"""Sinh CV tổng hợp từ các tin tuyển dụng thật bằng mô hình chạy local qua Ollama.

Chạy từ thư mục gốc của repo (Ollama phải đang chạy và đã có mô hình):

    ml/.venv/bin/python ml/scripts/generate_cvs.py --limit 3          # thử 3 CV
    ml/.venv/bin/python ml/scripts/generate_cvs.py                    # sinh đủ kế hoạch

Script quyết định những gì kiểm soát được (vị trí, số tháng kinh nghiệm, bậc học,
kỹ năng nào có mặt, mức khớp dự kiến); mô hình chỉ viết phần chữ. Nhờ vậy mức khớp
dự kiến của từng CV được biết trước và ghi vào `manifest.json` làm nhãn yếu cho
huấn luyện. Nhãn này KHÔNG thay cho điểm người chấm của tập vàng.

Kết quả: `ml/data/cv/synthetic/CV-xxx.json` và `manifest.json`. Chạy lại thì bỏ
qua CV đã có tệp, nên dừng giữa chừng rồi chạy tiếp được.

`--train` sinh kho CV huấn luyện (kế hoạch bản 3, mục 3.2): mỗi tin NGOÀI tập vàng
được `--per-job` CV (mặc định 8: 4 khớp mạnh, 2 khớp một phần, 2 vị trí gần), lưu ở
`ml/data/cv/train/TR-xxxx.json`. Tin của tập vàng không bao giờ làm tin neo, để
dữ liệu huấn luyện không rò rỉ sang tập đánh giá.

    ml/.venv/bin/python ml/scripts/generate_cvs.py --train --limit 2    # thử
    ml/.venv/bin/python ml/scripts/generate_cvs.py --train              # khoảng 560 CV, chạy qua đêm
"""

import argparse
import json
import random
import re
import time
import unicodedata
import urllib.request
from collections import defaultdict

from openpyxl import load_workbook
from paths import CV_MANIFEST, JD_INPUT, SYNTHETIC_CV_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST

OLLAMA_URL = 'http://127.0.0.1:11434/api/chat'


# Qwen đôi khi chuyển sang chữ khác giữa chừng (đã gặp tiếng Trung và tiếng Nga);
# CV có chữ cái không thuộc hệ Latin phải sinh lại.
def has_foreign_script(value):
    return any(
        char.isalpha() and not unicodedata.name(char, '').startswith('LATIN')
        for char in json.dumps(value, ensure_ascii=False)
    )


# Tên bằng mà mô hình phải ghi cho từng bậc học. Đợt sinh đầu không ràng buộc chỗ này
# nên 53/100 CV có tên bằng lệch với bậc học script đã chọn.
DEGREE_LABELS = {
    'vi': {
        'high_school': 'Trung học phổ thông',
        'intermediate': 'Trung cấp',
        'college': 'Cao đẳng',
        'university': 'Cử nhân',
        'postgraduate': 'Thạc sĩ',
    },
    'en': {
        'high_school': 'High School Diploma',
        'intermediate': 'Vocational Certificate',
        'college': 'College Diploma',
        'university': 'Bachelor',
        'postgraduate': 'Master',
    },
}
_DEGREE_PATTERNS = (
    ('postgraduate', r'thạc sĩ|master'),
    ('college', r'cao đẳng|college diploma|associate'),
    ('intermediate', r'trung cấp|vocational'),
    ('high_school', r'trung học phổ thông|high school'),
    ('university', r'cử nhân|kỹ sư|bachelor|đại học'),
)
MAX_SHORT_FIELD_CHARS = 120
# Tin neo cho kho huấn luyện: 4 CV khớp mạnh, 2 khớp một phần, 2 vị trí gần.
TRAIN_LEVELS = ['strong', 'partial', 'strong', 'adjacent', 'strong', 'partial', 'strong', 'adjacent']


def degree_level_of(degree):
    """Bậc học mà tên bằng nói ra, hoặc None nếu không rõ."""
    folded = degree.casefold()
    return next((level for level, pattern in _DEGREE_PATTERNS if re.search(pattern, folded)), None)


def has_runaway_text(data):
    """Ô ngắn (chức danh, tên công ty, tên bằng…) bị mô hình viết thành cả đoạn."""
    education = data.get('education') or {}
    short = [data.get('headline', ''), education.get('degree', ''), education.get('institution', '')]
    short += [job.get(key, '') for job in data.get('experience', []) for key in ('role', 'company')]
    short += [project.get(key, '') for project in data.get('projects', []) for key in ('name', 'role')]
    return any(len(str(value)) > MAX_SHORT_FIELD_CHARS for value in short)


TODAY_MONTH = (2026, 10)
# Nhóm vị trí của tập vàng (khớp tab Mục tiêu trong cv_inventory.xlsx) → số CV.
GOLD_CLUSTERS = {
    'Lập trình web (Fullstack/Backend)': (['Fullstack Developer', 'Backend Developer'], 10),
    'Lập trình Android/Mobile': (['Android Developer', 'iOS Developer', 'React Native/Flutter'], 8),
    'Kiểm thử phần mềm (Tester/QA)': (['Manual Tester', 'Automation Tester'], 8),
    'Kinh doanh/Bán hàng': (['Sales Online', 'Telesales', 'Sales Admin'], 10),
    'Kế toán': (['Kế toán tổng hợp', 'Kế toán công nợ', 'Chuyên viên thuế'], 8),
    'Content Marketing': (['Content Marketing', 'SEO/SEM'], 8),
    'Tuyển dụng/Nhân sự': (['Tuyển dụng', 'Hành chính văn phòng'], 5),
    'Chăm sóc khách hàng': (['Nhân viên CSKH'], 5),
}
# Mức khớp dự kiến so với tin gốc: tỷ lệ kỹ năng cần có được giữ lại.
MATCH_LEVELS = {'strong': (0.8, 1.0), 'partial': (0.35, 0.6), 'adjacent': (0.0, 0.25)}
LEVEL_PLAN = ['strong', 'partial', 'strong', 'adjacent', 'partial']
EXPERIENCE_BANDS = {'entry': (0, 0), 'junior': (8, 24), 'mid': (30, 60), 'senior': (66, 120)}
BAND_PLAN = ['junior', 'mid', 'entry', 'senior', 'mid', 'junior']
EDUCATION_BY_GROUP = {
    'Lao động phổ thông': ['high_school', 'intermediate'],
    'Chăm sóc khách hàng': ['college', 'university', 'high_school'],
    'Kinh doanh/Bán hàng': ['college', 'university'],
}
DEFAULT_EDUCATION = ['university', 'university', 'college', 'postgraduate']
CITIES = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế', 'Nha Trang']
COMPANY_KINDS = [
    'công ty khởi nghiệp', 'công ty vừa và nhỏ', 'tập đoàn đa quốc gia', 'công ty gia công',
    'chuỗi bán lẻ', 'ngân hàng', 'công ty thương mại điện tử', 'công ty sản xuất', 'agency',
]  # fmt: skip

RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'headline': {'type': 'string'},
        'summary': {'type': 'string'},
        'experience': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'role': {'type': 'string'},
                    'company': {'type': 'string'},
                    'highlights': {'type': 'array', 'items': {'type': 'string'}},
                },
                'required': ['role', 'company', 'highlights'],
            },
        },
        'education': {
            'type': 'object',
            'properties': {'degree': {'type': 'string'}, 'institution': {'type': 'string'}},
            'required': ['degree', 'institution'],
        },
        'projects': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'role': {'type': 'string'},
                    'highlights': {'type': 'array', 'items': {'type': 'string'}},
                },
                'required': ['name', 'role', 'highlights'],
            },
        },
        'certifications': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['headline', 'summary', 'experience', 'education', 'projects', 'certifications'],
}


def text(value):
    return '' if value is None else str(value).strip()


def split_skills(value):
    return [name.strip() for name in re.split(r'[;\n]', text(value)) if name.strip()]


def load_jobs():
    workbook = load_workbook(JD_INPUT, read_only=True, data_only=True)
    rows = list(workbook['JD'].iter_rows(values_only=True))
    headers = [text(cell) for cell in rows[0]]
    groups = {
        row[2]: row[0]
        for row in workbook['Danh mục'].iter_rows(min_row=2, values_only=True)
        if row[2]
    }
    jobs = []
    for values in rows[1:]:
        row = dict(zip(headers, values, strict=False))
        code = text(row.get('Mã tin'))
        if not code or code.upper().startswith('VD'):
            continue
        specialization = text(row.get('Vị trí chuyên môn'))
        jobs.append(
            {
                'code': code,
                'title': text(row.get('Tiêu đề tin')),
                'specialization': specialization,
                'group': groups.get(specialization, ''),
                'required': split_skills(row.get('Kỹ năng cần có')),
                'preferred': split_skills(row.get('Kỹ năng nên có')),
                'requirements': text(row.get('Yêu cầu ứng viên'))[:1200],
                'languages': [
                    {
                        'language': text(row.get(f'Ngoại ngữ {slot}')),
                        'level': text(row.get(f'Mức ngoại ngữ {slot}')) or 'Giao tiếp',
                        'certificate': text(row.get(f'Chứng chỉ {slot}')),
                    }
                    for slot in (1, 2)
                    if text(row.get(f'Ngoại ngữ {slot}'))
                ],
            }
        )
    return jobs


def build_plan(jobs, extra, seed):
    """Danh sách CV cần sinh: đủ chỉ tiêu tập vàng, thêm `extra` CV rải các vị trí khác."""
    rng = random.Random(seed)
    by_spec = defaultdict(list)
    for job in jobs:
        by_spec[job['specialization']].append(job)
    plan = []
    for cluster, (specializations, count) in GOLD_CLUSTERS.items():
        anchors = [job for spec in specializations for job in by_spec.get(spec, [])]
        for index in range(count):
            plan.append({'cluster': cluster, 'anchor': anchors[index % len(anchors)]})
    gold_specs = {spec for specs, _ in GOLD_CLUSTERS.values() for spec in specs}
    others = [job for job in jobs if job['specialization'] not in gold_specs]
    rng.shuffle(others)
    for job in others[:extra]:
        plan.append({'cluster': 'Khác (dữ liệu huấn luyện)', 'anchor': job})
    for index, item in enumerate(plan):
        item['code'] = f'CV-{index + 1:03d}'
        item['level'] = LEVEL_PLAN[index % len(LEVEL_PLAN)]
        item['band'] = BAND_PLAN[index % len(BAND_PLAN)]
        # Khoảng 30% CV viết bằng tiếng Anh.
        item['language'] = 'en' if rng.random() < 0.3 else 'vi'
    return plan


def build_train_plan(jobs, gold_codes, per_job, seed):
    """Kho huấn luyện: mỗi tin ngoài tập vàng làm tin neo cho `per_job` CV."""
    rng = random.Random(seed)
    plan = []
    for job in jobs:
        if job['code'] in gold_codes:
            continue
        for index in range(per_job):
            plan.append(
                {
                    'cluster': job['group'] or 'Khác',
                    'anchor': job,
                    'level': TRAIN_LEVELS[index % len(TRAIN_LEVELS)],
                    'band': BAND_PLAN[(len(plan) + index) % len(BAND_PLAN)],
                    'language': 'en' if rng.random() < 0.3 else 'vi',
                }
            )
    for index, item in enumerate(plan):
        item['code'] = f'TR-{index + 1:04d}'
    return plan


def pick_skills(item, jobs, rng):
    anchor = item['anchor']
    low, high = MATCH_LEVELS[item['level']]
    required = anchor['required']
    keep = round(len(required) * rng.uniform(low, high))
    if item['level'] == 'strong':
        keep = max(keep, min(len(required), 2))
    chosen = rng.sample(required, min(keep, len(required)))
    chosen += rng.sample(anchor['preferred'], min(len(anchor['preferred']), rng.randint(0, 2)))
    if item['level'] in ('partial', 'adjacent'):
        # CV khớp một phần vẫn đầy đặn: bù kỹ năng của một tin khác cùng nhóm ngành.
        # CV "vị trí gần" viết theo vị trí của tin đó thay vì vị trí của tin gốc.
        same_role = item['level'] == 'partial'
        neighbours = [
            job
            for job in jobs
            if job['group'] == anchor['group']
            and job['code'] != anchor['code']
            and (job['specialization'] == anchor['specialization']) == same_role
        ] or [job for job in jobs if job['group'] == anchor['group'] and job is not anchor]
        if neighbours:
            neighbour = rng.choice(neighbours)
            if not same_role:
                item['adjacent_role'] = neighbour['specialization']
            extra = [name for name in neighbour['required'] if name not in required]
            chosen += rng.sample(extra, min(len(extra), rng.randint(2, 4)))
    return list(dict.fromkeys(chosen))


def month_add(year_month, months):
    year, month = year_month
    total = year * 12 + month - 1 + months
    return total // 12, total % 12 + 1


def fmt(year_month):
    return f'{year_month[0]:04d}-{year_month[1]:02d}'


def timeline(months, jobs_count, rng):
    """Các khoảng làm việc liên tiếp, kết thúc ở tháng hiện tại, tổng đúng `months` tháng."""
    if months == 0:
        return []
    cuts = sorted(rng.sample(range(1, months), jobs_count - 1)) if months > jobs_count else []
    lengths = [b - a for a, b in zip([0, *cuts], [*cuts, months], strict=True)]
    ranges = []
    end = TODAY_MONTH
    for index, length in enumerate(reversed(lengths)):
        start = month_add(end, -(length - 1))
        ranges.append((fmt(start), None if index == 0 else fmt(end)))
        end = month_add(start, -1)
    return list(reversed(ranges))


def prompt_for(item, skills, months, jobs_count, rng, degree_label):
    anchor = item['anchor']
    language = 'tiếng Anh' if item['language'] == 'en' else 'tiếng Việt'
    role = item.get('adjacent_role') or anchor['specialization']
    years = (
        'chưa có kinh nghiệm đi làm (sinh viên mới tốt nghiệp)'
        if months == 0
        else f'{months} tháng kinh nghiệm'
    )
    return f"""Viết nội dung CV của một người tìm việc, hoàn toàn hư cấu, bằng {language}.

Hồ sơ cần viết:
- Vị trí đã/đang làm: {role}; {years}; số công việc đã làm: {jobs_count}.
- Từng làm ở {rng.choice(COMPANY_KINDS)} tại {rng.choice(CITIES)}. Tên công ty phải là tên tự đặt, không dùng tên công ty có thật.
- Kỹ năng thật sự có (chỉ dùng các kỹ năng này, không thêm kỹ năng chuyên môn khác): {', '.join(skills) or 'kỹ năng văn phòng cơ bản'}.
- Bậc học cao nhất: {degree_label}. Ô "education.degree" phải bắt đầu bằng đúng cụm "{degree_label}" rồi tới ngành học.

Yêu cầu:
- Mỗi công việc có 3–5 gạch đầu dòng mô tả việc đã làm và kết quả cụ thể (con số, quy mô); mỗi kỹ năng ở trên xuất hiện tự nhiên trong ít nhất một gạch đầu dòng.
- Không chép lại câu chữ của tin tuyển dụng; không nhắc tới tin tuyển dụng.
- Không ghi họ tên, email, số điện thoại, địa chỉ, ngày sinh.
- "experience" có đúng {jobs_count} phần tử, xếp từ cũ đến mới. "projects" có 0–2 dự án. "certifications" có 0–2 chứng chỉ phù hợp.
- "summary" 2–3 câu. "headline" là chức danh ngắn.

Tin tuyển dụng tham khảo để hiểu bối cảnh nghề (không chép):
{anchor['title']}
{anchor['requirements'][:600]}"""


def call_model(model, prompt, seed):
    body = json.dumps(
        {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'format': RESPONSE_SCHEMA,
            'stream': False,
            'options': {'temperature': 0.8, 'seed': seed, 'num_ctx': 4096},
        }
    ).encode()
    request = urllib.request.Request(
        OLLAMA_URL, data=body, headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(json.loads(response.read())['message']['content'])


def words(data):
    blob = ' '.join(
        [data['summary'], *[h for job in data['experience'] for h in job['highlights']]]
    ).casefold()
    return set(re.findall(r'\w+', blob))


def jaccard(a, b):
    return len(a & b) / max(1, len(a | b))


def education_for(item, rng, months):
    levels = EDUCATION_BY_GROUP.get(item['anchor']['group'], DEFAULT_EDUCATION)
    level = rng.choice(levels)
    years = {'postgraduate': 2, 'university': 4, 'college': 3, 'intermediate': 2}.get(level, 3)
    # Năm học bắt đầu tháng 9, tốt nghiệp tháng 6, trước công việc đầu tiên.
    graduated = month_add(TODAY_MONTH, -(months + rng.randint(1, 4)))
    end_year = graduated[0] if graduated[1] >= 6 else graduated[0] - 1
    return level, f'{end_year - years:04d}-09', f'{end_year:04d}-06'


def generate(item, jobs, model, seed, previous):
    rng = random.Random(seed)
    skills = pick_skills(item, jobs, rng)
    months = rng.randint(*EXPERIENCE_BANDS[item['band']])
    jobs_count = 0 if months == 0 else (1 if months < 18 else rng.randint(2, 3))
    ranges = timeline(months, jobs_count, rng) if jobs_count else []
    level, start, end = education_for(item, rng, months)
    degree_label = DEGREE_LABELS[item['language']][level]
    problems = []
    for attempt in range(3):
        prompt = prompt_for(item, skills, months, max(jobs_count, 1), rng, degree_label)
        data = call_model(model, prompt, seed + attempt)
        if not jobs_count:
            # Chưa đi làm: phần "kinh nghiệm" mô hình viết thành dự án học tập.
            data['projects'] = [
                {'name': job['role'], 'role': job['company'], 'highlights': job['highlights']}
                for job in data['experience']
            ] + data['projects']
            data['experience'] = []
        data['experience'] = data['experience'][: len(ranges)]
        similarity = max((jaccard(words(data), other) for other in previous), default=0)
        problems = [
            name
            for name, failed in (
                ('trùng nội dung với CV khác', similarity >= 0.45),
                ('lẫn chữ không phải Latin', has_foreign_script(data)),
                ('ô ngắn bị viết thành đoạn', has_runaway_text(data)),
                ('tên bằng lệch bậc học', degree_level_of(data['education'].get('degree', '')) != level),
            )
            if failed
        ]
        if not problems:
            break
    if problems == ['tên bằng lệch bậc học']:
        # Lỗi duy nhất còn lại sửa được mà không cần mô hình: đặt đúng cụm chỉ bậc học lên đầu.
        data['education']['degree'] = f'{degree_label} {data["education"].get("degree", "")}'.strip()
    elif problems:
        raise RuntimeError(f'Sau 3 lần sinh vẫn lỗi: {", ".join(problems)}.')
    for job, (job_start, job_end) in zip(data['experience'], ranges, strict=False):
        job['start_date'], job['end_date'] = job_start, job_end
    data['education'].update(degree_level=level, start_date=start, end_date=end)
    data['skills'] = [{'name': name, 'level': rng.randint(3, 5)} for name in skills]
    body = ' '.join(
        [data['summary']]
        + [line for job in data['experience'] for line in job['highlights']]
        + [line for project in data['projects'] for line in project['highlights']]
    ).casefold()
    return data, {
        'skills': skills,
        'experience_months': months,
        'education_level': level,
        'max_similarity': round(similarity, 3),
        # Tỷ lệ kỹ năng script chọn mà phần chữ có nhắc tên; cổng chất lượng dùng số này.
        'skills_in_text': round(sum(name.casefold() in body for name in skills) / max(1, len(skills)), 2),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model', default='qwen2.5:7b')
    parser.add_argument(
        '--extra', type=int, default=38, help='Số CV rải các vị trí ngoài tập vàng.'
    )
    parser.add_argument('--limit', type=int, default=0, help='Chỉ sinh N CV đầu (để thử).')
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--train', action='store_true', help='Sinh kho CV huấn luyện.')
    parser.add_argument('--per-job', type=int, default=8, help='Số CV mỗi tin neo (với --train).')
    options = parser.parse_args()

    jobs = load_jobs()
    if options.train:
        from build_gold_pairs import EXTENSION_JDS, GOLD_JDS

        plan = build_train_plan(jobs, {*GOLD_JDS, *EXTENSION_JDS}, options.per_job, options.seed)
        output_dir, manifest_path = TRAIN_CV_DIR, TRAIN_CV_MANIFEST
    else:
        plan = build_plan(jobs, options.extra, options.seed)
        output_dir, manifest_path = SYNTHETIC_CV_DIR, CV_MANIFEST
    if options.limit:
        plan = plan[: options.limit]
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = (
        json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    )
    previous = [
        words(json.loads((output_dir / f'{code}.json').read_text(encoding='utf-8')))
        for code in manifest
        if (output_dir / f'{code}.json').exists()
    ]

    failed = 0
    for number, item in enumerate(plan, start=1):
        path = output_dir / f'{item["code"]}.json'
        if path.exists():
            continue
        started = time.perf_counter()
        try:
            data, facts = generate(item, jobs, options.model, options.seed * 1000 + number, previous)
        except (RuntimeError, OSError, ValueError, KeyError) as error:
            # Một CV hỏng không dừng cả đợt chạy qua đêm; chạy lại sẽ thử lại CV này.
            failed += 1
            print(f'{item["code"]} BỎ QUA: {error}', flush=True)
            continue
        previous.append(words(data))
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        manifest[item['code']] = {
            'cluster': item['cluster'],
            'anchor_job': item['anchor']['code'],
            'anchor_specialization': item['anchor']['specialization'],
            'role_written': item.get('adjacent_role') or item['anchor']['specialization'],
            'intended_match': item['level'],
            'experience_band': item['band'],
            'language': item['language'],
            'model': options.model,
            **facts,
        }
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        print(
            f'{item["code"]} {item["language"]} {item["level"]:<8} {item["band"]:<6} '
            f'{manifest[item["code"]]["role_written"][:28]:<28} '
            f'{time.perf_counter() - started:5.1f}s sim={facts["max_similarity"]}',
            flush=True,
        )
    print(f'Xong: {len(manifest)} CV trong {output_dir}; {failed} CV bị bỏ qua lần này.')


if __name__ == '__main__':
    main()
