"""Tin tuyển dụng → `profile_json`.

Kỹ năng, kinh nghiệm, học vấn, cấp bậc, ngoại ngữ lấy từ trường có cấu trúc
nhà tuyển dụng đã chọn; chunk là tiêu đề, từng câu yêu cầu rồi từng câu mô tả
(mục yêu cầu được giữ trước khi phải cắt bớt), cuối cùng là tên từng kỹ năng.

Hai loại câu không thành chunk:
- tiêu đề con ("Required Skills", "Trình độ và kinh nghiệm:"): không phải yêu cầu;
- câu về giới tính, tuổi, ngoại hình, hôn nhân: hệ thống không chấm theo các
  thuộc tính này (kế hoạch mục 3), nên chúng không được đối sánh với CV.
"""

import re

from apps.jobs.models import Job
from common.html.plain_text import html_plain_text

from ..skills import TRAIT_GROUP
from .profile import MAX_JOB_CHUNKS, MIN_JOB_TEXT_CHARS, ExtractionError, make_chunks
from .text import detect_language, normalize_text, split_sentences

JOB_SECTION_PRIORITY = ('title', 'requirement', 'description')

# Số tháng tối thiểu ứng với mỗi mức `Job.ExperienceYears`.
_BAND_MONTHS = {
    Job.ExperienceYears.NONE: 0,
    Job.ExperienceYears.UNDER_1: 0,
    Job.ExperienceYears.ONE: 12,
    Job.ExperienceYears.TWO: 24,
    Job.ExperienceYears.THREE: 36,
    Job.ExperienceYears.FOUR: 48,
    Job.ExperienceYears.FIVE: 60,
    Job.ExperienceYears.OVER_5: 61,
}


MAX_SUBHEADING_WORDS = 5
_PROTECTED_ATTRIBUTE = re.compile(
    r'(?<!\w)(?:giới tính|độ tuổi|tuổi|ngoại hình|chiều cao|cân nặng|hôn nhân'
    r'|gender|age|years old|appearance|height|marital)(?!\w)',
    re.IGNORECASE,
)


# Tiêu đề tin hay kèm lương, địa điểm, giới tính, quảng cáo ("Kế Toán Quản Trị -
# Tuyển Nữ (Thu Nhập 15-20 Triệu) - Hóc Môn"); phép so chức danh chỉ dùng phần
# đầu là tên vị trí.
_TITLE_EXTRAS = re.compile(r'\s*[(\[{].*?[)\]}]\s*')
_TITLE_SEPARATOR = re.compile(r'\s+[-–—|/]\s+|\s*[|]\s*')


def role_title(title):
    """Phần tên vị trí của tiêu đề tin: bỏ ngoặc, lấy đoạn trước dấu gạch hay "|" đầu tiên."""
    cleaned = _TITLE_EXTRAS.sub(' ', title).strip()
    return _TITLE_SEPARATOR.split(cleaned, maxsplit=1)[0].strip() or title.strip()


def _is_subheading(line):
    """ "Kinh nghiệm:", "Required Skills", "Education & Background"; không phải "Thành thạo Excel"."""
    words = [word for word in line.split() if any(char.isalpha() for char in word)]
    title_case = 0 < len(words) <= MAX_SUBHEADING_WORDS and all(word[0].isupper() for word in words)
    return line.endswith(':') or (title_case and not line.endswith('.'))


def _job_sentences(text):
    """Câu yêu cầu/mô tả, bỏ tiêu đề con và câu về thuộc tính được bảo vệ."""
    lines = (line.strip() for line in normalize_text(text).split('\n'))
    return [
        sentence
        for line in lines
        if not _is_subheading(line)
        for sentence in split_sentences(line)
        if not _PROTECTED_ATTRIBUTE.search(sentence)
    ]


def _skills(job):
    rows = sorted(job.job_skills.all(), key=lambda row: (row.importance != 'required', row.pk))
    return [
        {
            'skill_id': row.skill_id,
            'name': row.skill.name,
            'group': row.skill.group.name if row.skill.group else '',
            'counted': not (row.skill.group and row.skill.group.name == TRAIT_GROUP),
            'source': 'job',
            'evidence': '',
            'importance': row.importance,
            'weight': float(row.weight),
        }
        for row in rows
    ]


def _provinces(job):
    provinces = {}
    for row in sorted(job.job_locations.all(), key=lambda row: (row.sort_order, row.pk)):
        place = row.location
        province = place if place.level == place.Level.PROVINCE else place.parent
        if province is not None:
            provinces.setdefault(province.pk, {'province_id': province.pk, 'name': province.name})
    return list(provinces.values())


def job_profile(job):
    """`job` cần nạp sẵn kỹ năng, ngoại ngữ, địa điểm (`models.jobs_for_profile`)."""
    description = html_plain_text(job.description)
    requirements = html_plain_text(job.requirements)
    text = '\n'.join(part for part in (job.title, description, requirements) if part)
    if len(text) < MIN_JOB_TEXT_CHARS:
        raise ExtractionError('job_text_too_short')

    entries = [('title', role_title(job.title))]
    entries += [('requirement', sentence) for sentence in _job_sentences(requirements)]
    entries += [('description', sentence) for sentence in _job_sentences(description)]
    skills = _skills(job)
    band = job.experience_years
    present = {
        'skills': bool(skills),
        'experience': bool(band),
        'education': bool(job.education_level),
        'position_level': bool(job.position_level),
    }
    chunks = make_chunks(entries, MAX_JOB_CHUNKS, priority=JOB_SECTION_PRIORITY)
    # Tên từng kỹ năng được đếm cũng là một chunk: bước chấm so nó với các câu của
    # CV để nhận kỹ năng viết khác tên (khớp ngữ nghĩa). Không tính vào giới hạn.
    chunks += [
        {'index': len(chunks) + order, 'section': 'skill', 'text': skill['name']}
        for order, skill in enumerate(skill for skill in skills if skill['counted'])
    ]
    return {
        'kind': 'job',
        'language': detect_language(text),
        'title': job.title,
        'skills': skills,
        'experience': {'months': _BAND_MONTHS.get(band) if band else None, 'band': band},
        'education': {'level': job.education_level},
        'position_level': job.position_level,
        'languages': [
            {'code': row.language.code, 'level': row.proficiency_level, 'required': row.is_required}
            for row in sorted(job.language_requirements.all(), key=lambda row: row.pk)
        ],
        'locations': _provinces(job),
        'work_types': list(job.work_types or ([job.work_type] if job.work_type else [])),
        'chunks': chunks,
        'quality': {
            'char_count': len(text),
            'chunk_count': len(chunks),
            'ocr_used': False,
            'missing': [name for name, ok in present.items() if not ok],
        },
    }
