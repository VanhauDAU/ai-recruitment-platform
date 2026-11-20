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


def cv_profile_json(
    *, source, language, title, skills, experience, education, position, languages, chunks
):
    """Lắp `profile_json` của CV và liệt kê tiêu chí thiếu dữ liệu.

    `experience` là {months, basis, items}; `months = None` nghĩa là không xác định.
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
        'quality': {
            'char_count': sum(len(chunk['text']) for chunk in chunks),
            'chunk_count': len(chunks),
            'ocr_used': False,
            'missing': [name for name, ok in present.items() if not ok],
        },
    }
