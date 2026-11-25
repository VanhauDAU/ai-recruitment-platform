"""Chia chunk và lắp `profile_json` của CV (dùng chung cho CV builder và CV tải lên)."""

from apps.cvs.services import months_to_experience_years, scrub_contacts

from ...domain import EXTRACTOR_VERSION
from .text import word_count

__all__ = ['EXTRACTOR_VERSION']  # nơi khác vẫn import từ đây


MAX_CV_CHARS = 20_000
MAX_CV_CHUNKS = 40
MAX_JOB_CHUNKS = 30
MAX_CHUNK_CHARS = 600
MIN_CV_TEXT_CHARS = 300
MIN_JOB_TEXT_CHARS = 200

# Thứ tự giữ lại khi CV dài quá `MAX_CV_CHUNKS`: phần chứng minh chuyên môn trước.
CV_SECTION_PRIORITY = (
    'title',
    'experience',
    'projects',
    'summary',
    'skills',
    'education',
    'certifications',
    'languages',
    'awards',
    'activities',
    'other',
)


# Nội dung CV theo mục, để hiển thị "hồ sơ trích xuất" (không dùng để chấm điểm).
DISPLAY_SECTION_ORDER = (
    'summary',
    'experience',
    'projects',
    'education',
    'skills',
    'certifications',
    'awards',
    'activities',
    'languages',
    'interests',
    'other',
)
MAX_DISPLAY_LINES = 400
MAX_DISPLAY_LINE_CHARS = 800


class ExtractionError(ValueError):
    """Tài liệu không đủ nội dung để phân tích; `code` là mã lỗi trả cho người dùng."""

    def __init__(self, code):
        self.code = code
        super().__init__(code)


def make_chunks(entries, limit, priority=CV_SECTION_PRIORITY):
    """[(mục, câu)] → [{index, section, text}].

    Bỏ email/số điện thoại, câu dưới hai từ (trừ chức danh) và câu trùng. Quá `limit` thì giữ theo
    thứ tự ưu tiên mục; kết quả vẫn theo thứ tự xuất hiện trong tài liệu.
    """
    rank = {section: order for order, section in enumerate(priority)}
    seen = set()
    candidates = []
    for position, (section, text) in enumerate(entries):
        text = ' '.join(scrub_contacts(text).split())[:MAX_CHUNK_CHARS]
        # Chức danh một từ ("Telesales") vẫn giữ; câu khác cần ít nhất hai từ.
        too_short = word_count(text) < (1 if section == 'title' else 2)
        if too_short or (section, text) in seen:
            continue
        seen.add((section, text))
        candidates.append((rank.get(section, len(rank)), position, section, text))
    kept = sorted(sorted(candidates)[:limit], key=lambda candidate: candidate[1])
    return [
        {'index': index, 'section': section, 'text': text}
        for index, (_, _, section, text) in enumerate(kept)
    ]


def display_item(*, title='', subtitle='', start=None, end=None, lines=()):
    """Một mục con để hiển thị: một công việc, một bằng cấp, một dự án, hoặc khối chữ của một mục.

    `start`/`end` dạng 'YYYY-MM' (CV tạo trên hệ thống); `end = None` kèm `start` là "đến nay".
    """
    return {
        'title': title,
        'subtitle': subtitle,
        'start': start or None,
        'end': end or None,
        'lines': list(lines),
    }


def make_sections(blocks):
    """[(mục, display_item)] → [{key, items}] theo `DISPLAY_SECTION_ORDER`.

    Khác `chunks` (đầu vào của bước chấm, tối đa 40 câu): đây là nội dung đầy đủ của CV
    theo từng mục để người xem đọc, chỉ bỏ email/số điện thoại và dòng rỗng. Giới hạn
    tổng số dòng để một tệp bất thường không làm phình hồ sơ.
    """
    grouped, budget = {}, MAX_DISPLAY_LINES
    for section, item in blocks:
        key = section if section in DISPLAY_SECTION_ORDER else 'other'
        lines = []
        for line in item['lines']:
            text = ' '.join(scrub_contacts(str(line)).split())[:MAX_DISPLAY_LINE_CHARS]
            # "Email:" còn lại sau khi bỏ địa chỉ email là nhãn rỗng, không phải nội dung.
            if text.endswith(':') and word_count(text) <= 3:
                continue
            if text and budget > 0:
                lines.append(text)
                budget -= 1
        cleaned = {
            **item,
            'title': ' '.join(scrub_contacts(item['title']).split())[:MAX_DISPLAY_LINE_CHARS],
            'subtitle': ' '.join(scrub_contacts(item['subtitle']).split())[:MAX_DISPLAY_LINE_CHARS],
            'lines': lines,
        }
        if cleaned['title'] or cleaned['subtitle'] or lines:
            grouped.setdefault(key, []).append(cleaned)
    return [{'key': key, 'items': grouped[key]} for key in DISPLAY_SECTION_ORDER if key in grouped]


def cv_profile_json(
    *,
    source,
    language,
    title,
    skills,
    experience,
    education,
    position,
    languages,
    chunks,
    sections,
):
    """Lắp `profile_json` của CV và liệt kê tiêu chí thiếu dữ liệu.

    `experience` là {months, basis, items}; `months = None` nghĩa là không xác định.
    `sections` (từ `make_sections`) là nội dung đầy đủ theo mục để hiển thị.
    """
    months = experience['months']
    present = {
        'skills': bool(skills),
        'experience': months is not None,
        'education': bool(education),
        'languages': bool(languages),
        'position_level': bool(position),
    }
    return {
        'kind': 'cv',
        'source': source,
        'language': language,
        'title': title,
        'skills': skills,
        'experience': {
            **experience,
            'band': months_to_experience_years(months).value if months is not None else '',
        },
        'education': {'level': education},
        'position_level': position,
        'languages': languages,
        'locations': [],
        'chunks': chunks,
        'sections': sections,
        'quality': {
            'char_count': sum(len(chunk['text']) for chunk in chunks),
            'chunk_count': len(chunks),
            'ocr_used': False,
            'missing': [name for name, ok in present.items() if not ok],
        },
    }
