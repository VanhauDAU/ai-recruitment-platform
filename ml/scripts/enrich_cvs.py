"""Bổ sung các mục Ngoại ngữ, Hoạt động, Giải thưởng, Sở thích cho CV tổng hợp đã sinh.

Chạy từ thư mục gốc của repo, sau `generate_cvs.py`:

    ml/.venv/bin/python ml/scripts/enrich_cvs.py

- Ngoại ngữ do script quyết định theo yêu cầu ngoại ngữ của tin gốc và mức khớp dự
  kiến của CV (CV khớp mạnh đáp ứng yêu cầu, CV khớp một phần thấp hơn một bậc),
  để mức đáp ứng ngoại ngữ được biết trước như kỹ năng và kinh nghiệm.
- Hoạt động, giải thưởng, sở thích do mô hình viết; không phải CV nào cũng có
  (giống CV thật), tỷ lệ cố định theo mã CV nên chạy lại cho cùng kết quả.

CV đã có trường `languages` được bỏ qua, nên chạy lại an toàn.

`--train` bổ sung cho kho CV huấn luyện (`generate_cvs.py --train`) theo đúng cách
và đúng tỷ lệ như kho CV của tập vàng, để mô hình được huấn luyện trên CV đầy đủ như
CV nó sẽ gặp lúc đánh giá và lúc chạy.
"""

import argparse
import json
import random
import urllib.request

from generate_cvs import OLLAMA_URL, has_foreign_script, load_jobs
from paths import CV_MANIFEST, SYNTHETIC_CV_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST

LEVELS = ['Cơ bản', 'Giao tiếp', 'Làm việc', 'Thành thạo', 'Bản ngữ']
LEVELS_EN = {
    'Cơ bản': 'Basic',
    'Giao tiếp': 'Conversational',
    'Làm việc': 'Working proficiency',
    'Thành thạo': 'Fluent',
    'Bản ngữ': 'Native',
}
LANGUAGE_NAMES_EN = {
    'Tiếng Anh': 'English',
    'Tiếng Nhật': 'Japanese',
    'Tiếng Hàn': 'Korean',
    'Tiếng Trung': 'Chinese',
    'Tiếng Pháp': 'French',
    'Tiếng Việt': 'Vietnamese',
}
ENGLISH_CERTIFICATES = [
    'TOEIC 550',
    'TOEIC 650',
    'TOEIC 750',
    'IELTS 5.5',
    'IELTS 6.0',
    'IELTS 6.5',
]
OPTIONAL_SCHEMA = {
    'type': 'object',
    'properties': {
        'activities': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                    'organization': {'type': 'string'},
                    'highlights': {'type': 'array', 'items': {'type': 'string'}},
                },
                'required': ['name', 'organization', 'highlights'],
            },
        },
        'awards': {'type': 'array', 'items': {'type': 'string'}},
        'interests': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['activities', 'awards', 'interests'],
}
# Tên tổ chức, giải thưởng, sở thích chỉ vài từ. Dài hơn thế là mô hình viết lẫn
# lời thoại vào ô (đã gặp ở CV-070: "Replies to the previous question: Here's…").
MAX_SHORT_FIELD_CHARS = 120


def has_runaway_text(extra):
    short = [
        *(item.get(key, '') for item in extra['activities'] for key in ('name', 'organization')),
        *extra['awards'],
        *extra['interests'],
    ]
    return any(len(str(value)) > MAX_SHORT_FIELD_CHARS for value in short)


def lower(level, steps=1):
    return LEVELS[max(0, LEVELS.index(level) - steps)] if level in LEVELS else 'Cơ bản'


def languages_for(facts, job, rng):
    """Danh sách {language, level, certificate} của CV, theo yêu cầu của tin gốc."""
    result = {}
    for requirement in job['languages']:
        name, level = requirement['language'], requirement['level']
        if facts['intended_match'] == 'strong':
            result[name] = (level, requirement['certificate'])
        elif facts['intended_match'] == 'partial' or rng.random() < 0.4:
            result[name] = (lower(level), '')
    if 'Tiếng Anh' not in result and rng.random() < 0.7:
        level = rng.choice(['Cơ bản', 'Giao tiếp', 'Giao tiếp', 'Làm việc'])
        certificate = rng.choice(ENGLISH_CERTIFICATES) if level == 'Làm việc' else ''
        result['Tiếng Anh'] = (level, certificate)
    if facts['language'] == 'en':
        result.setdefault('Tiếng Anh', ('Làm việc', rng.choice(ENGLISH_CERTIFICATES)))
        result['Tiếng Việt'] = ('Bản ngữ', '')
    return [
        {'language': name, 'level': level, 'certificate': certificate}
        for name, (level, certificate) in result.items()
    ]


def optional_sections(facts, model, seed):
    language = 'tiếng Anh' if facts['language'] == 'en' else 'tiếng Việt'
    prompt = f"""Viết thêm các mục phụ cho CV hư cấu của một người làm {facts['role_written']}, bằng {language}.
- "activities": 1–2 hoạt động ngoại khóa hoặc tình nguyện (tên hoạt động, tổ chức tự đặt, 1–2 gạch đầu dòng).
- "awards": 0–2 giải thưởng hoặc danh hiệu hợp với nghề, không bịa giải thưởng quốc tế lớn.
- "interests": 2–4 sở thích ngắn.
Không ghi tên người, tên trường hay công ty có thật."""
    body = json.dumps(
        {
            'model': model,
            'messages': [{'role': 'user', 'content': prompt}],
            'format': OPTIONAL_SCHEMA,
            'stream': False,
            'options': {'temperature': 0.9, 'seed': seed, 'num_ctx': 2048},
        }
    ).encode()
    request = urllib.request.Request(
        OLLAMA_URL, data=body, headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(json.loads(response.read())['message']['content'])


def localized(languages, cv_language):
    if cv_language != 'en':
        return languages
    return [
        {
            'language': LANGUAGE_NAMES_EN.get(item['language'], item['language']),
            'level': LEVELS_EN.get(item['level'], item['level']),
            'certificate': item['certificate'],
        }
        for item in languages
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model', default='qwen2.5:7b')
    parser.add_argument('--train', action='store_true', help='Bổ sung cho kho CV huấn luyện.')
    options = parser.parse_args()

    jobs = {job['code']: job for job in load_jobs()}
    output_dir, manifest_path = (
        (TRAIN_CV_DIR, TRAIN_CV_MANIFEST) if options.train else (SYNTHETIC_CV_DIR, CV_MANIFEST)
    )
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for code, facts in manifest.items():
        path = output_dir / f'{code}.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        if 'languages' in data:
            continue
        rng = random.Random(f'enrich-{code}')
        languages = languages_for(facts, jobs[facts['anchor_job']], rng)
        data['languages'] = localized(languages, facts['language'])
        seed = rng.randint(1, 10**6)
        for attempt in range(3):
            try:
                extra = optional_sections(facts, options.model, seed + attempt)
            except (OSError, ValueError, KeyError):
                continue
            if not has_foreign_script(extra) and not has_runaway_text(extra):
                break
        else:
            # Một CV hỏng không dừng cả đợt chạy dài; chạy lại sẽ thử lại CV này.
            print(f'{code} BỎ QUA: mục phụ vẫn lẫn chữ lạ hoặc lời thoại sau 3 lần sinh.', flush=True)
            continue
        data['activities'] = extra['activities'] if rng.random() < 0.6 else []
        data['awards'] = extra['awards'] if rng.random() < 0.35 else []
        data['interests'] = extra['interests'] if rng.random() < 0.7 else []
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        facts['languages'] = languages
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        print(
            f'{code} ngoại ngữ={len(languages)} hoạt động={len(data["activities"])} '
            f'giải thưởng={len(data["awards"])} sở thích={len(data["interests"])}',
            flush=True,
        )


if __name__ == '__main__':
    main()
