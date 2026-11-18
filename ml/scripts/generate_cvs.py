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
from paths import CV_MANIFEST, JD_INPUT
from paths import SYNTHETIC_CV_DIR as OUTPUT_DIR

OLLAMA_URL = 'http://127.0.0.1:11434/api/chat'


# Qwen đôi khi chuyển sang chữ khác giữa chừng (đã gặp tiếng Trung và tiếng Nga);
# CV có chữ cái không thuộc hệ Latin phải sinh lại.
def has_foreign_script(value):
    return any(
        char.isalpha() and not unicodedata.name(char, '').startswith('LATIN')
        for char in json.dumps(value, ensure_ascii=False)
    )


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


def prompt_for(item, skills, months, jobs_count, rng):
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
    for attempt in range(3):
        data = call_model(
            model, prompt_for(item, skills, months, max(jobs_count, 1), rng), seed + attempt
        )
        if not jobs_count:
            # Chưa đi làm: phần "kinh nghiệm" mô hình viết thành dự án học tập.
            data['projects'] = [
                {'name': job['role'], 'role': job['company'], 'highlights': job['highlights']}
                for job in data['experience']
            ] + data['projects']
            data['experience'] = []
        data['experience'] = data['experience'][: len(ranges)]
        similarity = max((jaccard(words(data), other) for other in previous), default=0)
        if similarity < 0.45 and not has_foreign_script(data):
            break
    else:
        raise RuntimeError('Sau 3 lần sinh vẫn trùng nội dung hoặc lẫn chữ không phải Latin.')
    for job, (start, end) in zip(data['experience'], ranges, strict=False):
        job['start_date'], job['end_date'] = start, end
    level, start, end = education_for(item, rng, months)
    data['education'].update(degree_level=level, start_date=start, end_date=end)
    data['skills'] = [{'name': name, 'level': rng.randint(3, 5)} for name in skills]
    return data, {
        'skills': skills,
        'experience_months': months,
        'education_level': level,
        'max_similarity': round(similarity, 3),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model', default='qwen2.5:7b')
    parser.add_argument(
        '--extra', type=int, default=38, help='Số CV rải các vị trí ngoài tập vàng.'
    )
    parser.add_argument('--limit', type=int, default=0, help='Chỉ sinh N CV đầu (để thử).')
    parser.add_argument('--seed', type=int, default=42)
    options = parser.parse_args()

    jobs = load_jobs()
    plan = build_plan(jobs, options.extra, options.seed)
    if options.limit:
        plan = plan[: options.limit]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = CV_MANIFEST
    manifest = (
        json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    )
    previous = [
        words(json.loads((OUTPUT_DIR / f'{code}.json').read_text(encoding='utf-8')))
        for code in manifest
        if (OUTPUT_DIR / f'{code}.json').exists()
    ]

    for number, item in enumerate(plan, start=1):
        path = OUTPUT_DIR / f'{item["code"]}.json'
        if path.exists():
            continue
        started = time.perf_counter()
        data, facts = generate(item, jobs, options.model, options.seed * 1000 + number, previous)
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
    print(f'Xong: {len(manifest)} CV trong {OUTPUT_DIR}')


if __name__ == '__main__':
    main()
