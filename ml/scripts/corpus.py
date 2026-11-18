"""Nạp kho JD và CV thành văn bản thuần cho baseline và ghép cặp (không cần Django).

- JD lấy từ `jd_input.xlsx` (đúng nội dung đã nhập vào hệ thống), chỉ các tin có
  trong `jd_import_map.json`.
- CV lấy từ `synthetic/CV-xxx.json`, ghép các mục theo thứ tự trên CV.
"""

import json
import re
import unicodedata

import openpyxl
from paths import CV_MANIFEST, JD_IMPORT_MAP, JD_INPUT, SYNTHETIC_CV_DIR

# Giữ ký tự trong tên công nghệ (node.js, c++, c#, .net); dấu chấm cuối câu bị bỏ.
TOKEN = re.compile(r'[^\W_][\w+#.]*', re.UNICODE)
JD_TEXT_COLUMNS = (
    'Tiêu đề tin',
    'Vị trí chuyên môn',
    'Kỹ năng cần có',
    'Kỹ năng nên có',
    'Mô tả công việc',
    'Yêu cầu ứng viên',
)


def tokenize(text):
    """Âm tiết/từ viết thường đã chuẩn hóa NFC, kèm bigram âm tiết liền nhau."""
    text = unicodedata.normalize('NFC', text).casefold()
    unigrams = [token.rstrip('.') for token in TOKEN.findall(text)]
    unigrams = [token for token in unigrams if token]
    return unigrams + [f'{left}_{right}' for left, right in zip(unigrams, unigrams[1:])]


def load_jds():
    """Danh sách {code, title, language, cluster, text} theo thứ tự mã tin."""
    imported = json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8'))
    sheet = openpyxl.load_workbook(JD_INPUT, read_only=True, data_only=True)['JD']
    rows = sheet.iter_rows(values_only=True)
    header = [str(cell or '').strip() for cell in next(rows)]
    jds = []
    for row in rows:
        record = dict(zip(header, row))
        code = str(record.get('Mã tin') or '').strip()
        if code not in imported:
            continue
        parts = [str(record.get(column) or '').strip() for column in JD_TEXT_COLUMNS]
        jds.append(
            {
                'code': code,
                'title': str(record['Tiêu đề tin']).strip(),
                'position': str(record.get('Vị trí chuyên môn') or '').strip(),
                'language': imported[code]['language'],
                'slug': imported[code]['slug'],
                'text': '\n'.join(part for part in parts if part),
            }
        )
    return sorted(jds, key=lambda jd: jd['code'])


def cv_text(data):
    lines = [data.get('headline', ''), data.get('summary', '')]
    for job in data.get('experience', []):
        lines.append(f'{job.get("role", "")} - {job.get("company", "")}')
        lines += job.get('highlights', [])
    education = data.get('education') or {}
    lines.append(f'{education.get("degree", "")} - {education.get("institution", "")}')
    for project in data.get('projects', []):
        lines.append(f'{project.get("name", "")} - {project.get("role", "")}')
        lines += project.get('highlights', [])
    lines.append(', '.join(skill['name'] for skill in data.get('skills', [])))
    lines += data.get('certifications', [])
    lines += [
        ' '.join(filter(None, (item['language'], item.get('level'), item.get('certificate'))))
        for item in data.get('languages', [])
    ]
    for activity in data.get('activities', []):
        lines.append(f'{activity.get("name", "")} - {activity.get("organization", "")}')
        lines += activity.get('highlights', [])
    lines += data.get('awards', []) + data.get('interests', [])
    return '\n'.join(line for line in (str(line).strip() for line in lines) if line)


def load_cvs():
    """Danh sách {code, headline, language, anchor_job, intended_match, text}."""
    manifest = json.loads(CV_MANIFEST.read_text(encoding='utf-8'))
    cvs = []
    for code, facts in sorted(manifest.items()):
        data = json.loads((SYNTHETIC_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))
        cvs.append(
            {
                'code': code,
                'headline': data.get('headline', ''),
                'language': facts['language'],
                'anchor_job': facts['anchor_job'],
                'cluster': facts['cluster'],
                'intended_match': facts['intended_match'],
                'text': cv_text(data),
            }
        )
    return cvs
