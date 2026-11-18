"""CV tải lên (văn bản đọc từ PDF/DOCX) → `profile_json`.

Các bước:

1. `read_layout`: chia văn bản thành mục theo dòng tiêu đề ("KINH NGHIỆM LÀM
   VIỆC", "Skills"…), nối dòng bị PDF ngắt giữa câu, nhận ra bố cục bị đảo.
   PDF hai cột thường đọc hết cột này rồi mới tới cột kia, nên các tiêu đề đứng
   liền nhau không có nội dung và chữ rơi vào sai mục.
2. Số tháng kinh nghiệm theo bốn trường hợp, ghi vào `experience.basis`:
   - `section`: mục kinh nghiệm có khoảng ngày → dùng các khoảng đó;
   - `whole_text`: mục kinh nghiệm không có ngày nhưng nơi khác có dòng ngày
     giống việc làm (không nói về nơi học; với bố cục gọn thì còn bỏ qua mục dự
     án, hoạt động, chứng chỉ, giải thưởng) → dùng các dòng đó, độ tin cậy thấp;
   - `no_experience_section`: bố cục gọn (mọi tiêu đề đều có nội dung), không có
     mục kinh nghiệm và không có dòng ngày như trên → 0 tháng;
   - rỗng (`months = None`): còn lại, tức không chắc. Hệ thống không kết luận
     "chưa đi làm" khi không chắc.
3. Kỹ năng, bậc học, ngoại ngữ, cấp bậc như CV builder nhưng đọc từ chữ.
"""

import re
from dataclasses import dataclass

from apps.cvs.services import heading_section, merged_months
from common.vietnam_time import vietnam_today

from ..skills import MIN_EVIDENCE_WORDS, cv_skills
from . import facts
from .profile import (
    CV_SECTION_PRIORITY,
    MAX_CV_CHARS,
    MAX_CV_CHUNKS,
    MIN_CV_TEXT_CHARS,
    ExtractionError,
    cv_profile_json,
    make_chunks,
)
from .text import detect_language, normalize_text, reflow_lines, split_sentences

# Mục không đưa vào chunk: thông tin cá nhân, người tham chiếu, sở thích.
SKIPPED_SECTIONS = ('personal', 'references', 'interests')
MAX_HEADING_WORDS = 5
MAX_TITLE_WORDS = 10
_LIST_SEPARATORS = re.compile(r'[,;|•·/]')


@dataclass
class CvLayout:
    segments: list  # [(mục, [dòng])], phần trước tiêu đề đầu tiên là 'header'
    headings: set  # mục có dòng tiêu đề trong tệp
    # Có tiêu đề không kèm nội dung: thứ tự đọc bị đảo, chữ có thể nằm sai mục.
    scrambled: bool

    @property
    def lines(self):
        return [line for _, lines in self.segments for line in lines]

    def section(self, name):
        return [line for section, lines in self.segments if section == name for line in lines]


def _heading(line):
    """Mục mà dòng tiêu đề gọi tên; dòng dài hay có dấu câu cuối không phải tiêu đề."""
    if len(line.split()) > MAX_HEADING_WORDS or line.endswith(('.', ',', ';')):
        return None
    return heading_section(line)


def read_layout(text):
    segments = [('header', [])]
    for line in (raw.strip() for raw in normalize_text(text).split('\n')):
        if not line:
            continue
        section = _heading(line)
        if section:
            segments.append((section, []))
            if ':' in line and line.split(':', 1)[1].strip():
                segments[-1][1].append(line.split(':', 1)[1].strip())
        else:
            segments[-1][1].append(line)
    empty = sum(1 for section, lines in segments[1:] if not lines)
    return CvLayout(
        segments=[(section, reflow_lines(lines)) for section, lines in segments if lines],
        headings={section for section, _ in segments[1:]},
        scrambled=empty > 0,
    )


# Một mục (việc làm hay học vấn) gồm dòng có ngày và tối đa hai dòng dưới, dừng
# ở dòng có ngày kế tiếp (mẫu CV hay ghi ngày, bằng cấp, tên trường liền nhau).
ENTRY_LINES_AFTER = 2


def _entry_block(lines, index):
    block = [lines[index]]
    for line in lines[index + 1 : index + 1 + ENTRY_LINES_AFTER]:
        if facts.has_date(line):
            break
        block.append(line)
    return ' '.join(block)


def _is_education_line(lines, index):
    """Dòng thuộc một mục học vấn: khối của nó nhắc tới nơi học hay bằng cấp."""
    return facts.mentions_school(_entry_block(lines, index))


def _dated_lines(lines, now, *, allow_open_start):
    """Khoảng ngày, dòng chứa chúng và dòng chức danh (dòng có ngày và dòng ngay sau)."""
    ranges, items, titles = [], [], []
    for index, line in enumerate(lines):
        found = facts.date_ranges(line, now)
        start = facts.open_start_date(line) if allow_open_start and not found else None
        if start is not None:
            found = [(start, now)]
        if found:
            ranges += found
            items.append({'text': line})
            titles += lines[index : index + 2]
    return ranges, items, titles


# Ngày trong các mục này không phải thời gian đi làm. Mục học vấn không có ở
# đây: dòng học được lọc từng dòng (`mentions_school`), vì mẫu CV hay để dòng
# việc làm ngay dưới học vấn.
NON_JOB_SECTIONS = ('projects', 'activities', 'certifications', 'awards')


def _job_like_lines(layout):
    """Dòng có thể ghi thời gian đi làm khi mục kinh nghiệm không dùng được."""
    segments = layout.segments if layout.scrambled else [
        (section, lines) for section, lines in layout.segments if section not in NON_JOB_SECTIONS
    ]  # fmt: skip
    lines = [line for _, lines in segments for line in lines]
    return [line for index, line in enumerate(lines) if not _is_education_line(lines, index)]


def _experience(layout, now):
    """({months, basis, items}, dòng chức danh) theo bốn trường hợp ở đầu tệp."""
    ranges, items, titles = _dated_lines(layout.section('experience'), now, allow_open_start=True)
    basis = 'section'
    if not ranges:
        ranges, items, titles = _dated_lines(_job_like_lines(layout), now, allow_open_start=False)
        basis = 'whole_text'
    if ranges:
        months = merged_months(ranges, now)
    elif not layout.scrambled and 'experience' not in layout.headings:
        months, basis = 0, 'no_experience_section'
    else:
        months, basis = None, ''
    return {'months': months, 'basis': basis, 'items': items}, titles


def _education(layout, now):
    """Bậc học từ mục học vấn; bố cục bị đảo thì từ khối có ngày nói về nơi học."""
    lines = layout.section('education')
    if layout.scrambled or not lines:
        all_lines = layout.lines
        lines = [
            _entry_block(all_lines, index)
            for index, line in enumerate(all_lines)
            if facts.date_ranges(line, now) and _is_education_line(all_lines, index)
        ] or lines
    return facts.education_level('\n'.join(lines))


def _language_lines(layout):
    """Dòng ngoại ngữ; dòng mức độ ("Giao tiếp") gộp vào dòng tên ngôn ngữ ngay trước."""
    runs = []
    for line in layout.section('languages'):
        if facts.language_codes(line) or not runs:
            runs.append(line)
        else:
            runs[-1] = f'{runs[-1]} {line}'
    return runs or [
        line for line in layout.lines if facts.language_codes(line) and facts.language_level(line)
    ]


def text_cv_profile(text, catalog, *, today=None):
    today = today or vietnam_today()
    now = today.year * 12 + today.month - 1
    text = normalize_text(text)[:MAX_CV_CHARS]
    if len(text.strip()) < MIN_CV_TEXT_CHARS:
        raise ExtractionError('cv_text_unavailable')

    layout = read_layout(text)
    entries = [
        (section if section in CV_SECTION_PRIORITY else 'other', sentence)
        for section, lines in layout.segments
        if section not in SKIPPED_SECTIONS
        for sentence in split_sentences('\n'.join(lines))
    ]
    experience, titles = _experience(layout, now)
    chunks = make_chunks(entries, MAX_CV_CHUNKS)
    return cv_profile_json(
        source='upload',
        language=detect_language(' '.join(chunk['text'] for chunk in chunks)),
        title='',
        skills=cv_skills(
            catalog,
            declared_names=[
                name.strip()
                for line in layout.section('skills')
                for name in _LIST_SEPARATORS.split(line)
            ],
            # Dòng ngắn ở cột bên của PDF nhiều cột cũng là danh sách liệt kê.
            listings=[
                line
                for section, lines in layout.segments
                if section != 'languages'  # "Giao tiếp" ở đây là mức ngoại ngữ
                for line in lines
                if len(line.split()) < MIN_EVIDENCE_WORDS
            ],
            sentences=[text for section, text in entries if section not in ('skills', 'languages')],
        ),
        experience=experience,
        education=_education(layout, now),
        # Chỉ dòng ngắn mới là chức danh; câu mô tả ("báo cáo cho Giám đốc") thì không.
        position=facts.position_level(
            ' | '.join(line for line in titles if len(line.split()) <= MAX_TITLE_WORDS),
            experience['months'],
        ),
        languages=facts.cv_languages(_language_lines(layout)),
        chunks=chunks,
    )
