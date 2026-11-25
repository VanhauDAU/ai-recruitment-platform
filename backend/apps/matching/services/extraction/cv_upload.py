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
3. Kỹ năng, bậc học, ngoại ngữ như CV builder nhưng đọc từ chữ.
4. Chức danh (`title`, dùng cho phép so chức danh với tin): dòng ngắn ở đầu trang
   mà nội dung CV nhắc lại, hoặc chức danh lặp lại ở các mục việc làm.
5. Cấp bậc lấy theo việc gần nhất (và chức danh), không theo chức danh cao nhất
   từng giữ.
"""

import re
from collections import Counter
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
    display_item,
    make_chunks,
    make_sections,
)
from .text import BULLET, detect_language, normalize_text, reflow_lines, split_sentences, word_count

# Mục không đưa vào chunk: thông tin cá nhân, người tham chiếu, sở thích.
SKIPPED_SECTIONS = ('personal', 'references', 'interests')
DISPLAY_SKIPPED_SECTIONS = ('header', 'personal', 'references')
MAX_HEADING_WORDS = 5
MAX_SKILL_LABEL_WORDS = 4
MAX_TITLE_WORDS = 10
_LIST_SEPARATORS = re.compile(r'[,;|•·]')
# Số dòng quanh dòng ngày của một việc có thể ghi chức danh (mẫu CV in chức danh trên
# hoặc dưới dòng ngày).
TITLE_LINES_BEFORE, TITLE_LINES_AFTER = 2, 1


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
    # Đếm từ có chữ cái: "DỰ ÁN & KINH NGHIỆM" là bốn từ, dấu "&" không tính.
    if word_count(line) > MAX_HEADING_WORDS or line.endswith(('.', ',', ';')):
        return None
    return heading_section(line)


# Dòng không thuộc nội dung CV: chân trang của công cụ tạo CV, số trang.
_NOISE_LINE = re.compile(
    r'^(?:©|\(c\)\s)|\btopcv\.vn\b|^(?:trang|page)\s*\d+(?:\s*/\s*\d+)?$', re.IGNORECASE
)


def _continues_section(line, section, current):
    """Dòng trông như tiêu đề nhưng thật ra là nội dung của mục đang đọc.

    - Cùng mục với mục đang đọc: "Kỹ năng giao tiếp" dưới tiêu đề "Kỹ năng" là một kỹ
      năng, không phải tiêu đề lặp lại.
    - Trong mục kỹ năng, dòng mở đầu bằng chữ "Kỹ năng" vẫn là một kỹ năng dù có từ
      khóa của mục khác ("Kỹ năng ngoại ngữ").
    """
    if section == current:
        return True
    return current == 'skills' and heading_section(' '.join(line.split()[:2])) == 'skills'


def read_layout(text):
    segments = [('header', [])]
    for line in (raw.strip() for raw in normalize_text(text).split('\n')):
        if not line or _NOISE_LINE.search(line):
            continue
        section = _heading(line)
        if section and _continues_section(line, section, segments[-1][0]):
            # "Tools: Git, Docker" trong mục kỹ năng: nhãn con, nội dung là phần sau dấu hai chấm.
            label, _, value = line.partition(':')
            if value.strip() and heading_section(label) == section:
                line = value.strip()
            section = None
        if section:
            segments.append((section, []))
            if ':' in line and line.split(':', 1)[1].strip():
                segments[-1][1].append(line.split(':', 1)[1].strip())
        else:
            segments[-1][1].append(line)
    empty = sum(1 for section, lines in segments[1:] if not lines)
    return CvLayout(
        # Phần đầu trang là tên, chức danh, liên hệ: mỗi dòng một ý, không nối như câu văn.
        segments=[
            (section, lines if section == 'header' else reflow_lines(lines))
            for section, lines in segments
            if lines
        ],
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


def _is_short_title(line):
    """Dòng ngắn không có ngày: chức danh hoặc tên công ty, không phải câu mô tả."""
    return (
        word_count(line) <= MAX_TITLE_WORDS and not facts.has_date(line) and not BULLET.match(line)
    )


def _title_lines(lines, index):
    """Dòng quanh dòng ngày `index` có thể ghi chức danh của mục đó.

    Phía trên chỉ lấy các dòng ngắn đứng liền dòng ngày: gặp câu mô tả là đã sang
    phần của mục trước, không lấy chức danh của việc trước.
    """
    before = []
    for line in reversed(lines[max(index - TITLE_LINES_BEFORE, 0) : index]):
        if not _is_short_title(line):
            break
        before.insert(0, line)
    after = lines[index : index + 1 + TITLE_LINES_AFTER]
    return before + after


def _dated_lines(lines, now, *, allow_open_start):
    """Các mục có ngày: [(khoảng ngày của mục, dòng chứa ngày, các dòng có thể là chức danh)]."""
    entries = []
    used = set()  # dòng mốc cuối của một khoảng in thành hai dòng
    for index, line in enumerate(lines):
        if index in used:
            continue
        found = facts.date_ranges(line, now)
        stacked = None if found else facts.stacked_range(lines, index, now)
        if stacked is not None:
            found = [stacked[0]]
            used.add(stacked[1])
        start = facts.open_start_date(line) if allow_open_start and not found else None
        if start is not None:
            found = [(start, now)]
        if found:
            entries.append((found, line, _title_lines(lines, index)))
    return entries


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
    """({months, basis, items}, dòng quanh việc gần nhất, dòng quanh mọi việc) theo bốn trường hợp ở đầu tệp."""
    entries = _dated_lines(layout.section('experience'), now, allow_open_start=True)
    basis = 'section'
    if not entries:
        entries = _dated_lines(_job_like_lines(layout), now, allow_open_start=False)
        basis = 'whole_text'
    ranges = [found for ranges, _, _ in entries for found in ranges]
    if ranges:
        months = merged_months(ranges, now)
    elif not layout.scrambled and 'experience' not in layout.headings:
        months, basis = 0, 'no_experience_section'
    else:
        months, basis = None, ''
    # Việc gần nhất: mục có mốc cuối muộn nhất; bằng nhau thì mục bắt đầu muộn hơn.
    latest = max(
        entries, key=lambda entry: max((end, start) for start, end in entry[0]), default=None
    )
    experience = {
        'months': months,
        'basis': basis,
        'items': [{'text': line} for _, line, _ in entries],
    }
    return (
        experience,
        latest[2] if latest else [],
        [line for _, _, around in entries for line in around],
    )


_TITLE_PARTS = re.compile(r'\s{2,}|\s*[,|]\s*')


def _title_parts(lines):
    """Các mẩu có thể là chức danh trong những dòng ngắn quanh tên hoặc ngày tháng.

    Một dòng có thể gộp nhiều thứ cùng hàng ("Admin Officer  an@example.com  0912…",
    "CodeMasters, Fullstack Developer"): tách ở dấu phẩy, "|" hoặc khoảng trắng rộng,
    và cắt mỗi mẩu ở từ đầu tiên có số hay "@".
    """
    parts = []
    for line in lines:
        for part in _TITLE_PARTS.split(line):
            words = []
            for word in part.split():
                if '@' in word or any(char.isdigit() for char in word):
                    break
                words.append(word)
            if 1 <= len(words) <= MAX_TITLE_WORDS and ':' not in part:
                parts.append(' '.join(words))
    return parts


def _title(layout, latest_titles, job_titles):
    """Chức danh của CV, hoặc rỗng nếu không chắc.

    Chức danh là một mẩu ngắn có từ chỉ nghề (`facts.looks_like_job_title`), tìm theo
    thứ tự: phần đầu trang, rồi mẩu lặp lại nhiều nhất quanh ngày của các việc, rồi
    mẩu quanh ngày của việc gần nhất. Mẩu ở đầu trang không có từ chỉ nghề vẫn được
    nhận nếu mục kinh nghiệm hoặc giới thiệu nhắc lại nguyên văn: tên người không
    xuất hiện ở đó.
    """
    header = _title_parts(layout.section('header'))
    body = '\n'.join(layout.section('experience') + layout.section('summary')).casefold()
    roles = [part for part in _title_parts(job_titles) if facts.looks_like_job_title(part)]
    repeated = [part for part, count in Counter(roles).most_common(1) if count >= 2]
    candidates = (
        [part for part in header if facts.looks_like_job_title(part)]
        + [part for part in header if len(part.split()) > 1 and part.casefold() in body]
        + repeated
        + [part for part in _title_parts(latest_titles) if facts.looks_like_job_title(part)]
    )
    return candidates[0] if candidates else ''


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


def _declared_names(lines, catalog):
    """Tên kỹ năng khai ở mục kỹ năng. "CI/CD", "UI/UX" là một tên; "Java/Kotlin" là hai."""
    names = []
    for line in lines:
        # "Tools: Git, Docker": nhãn con ngắn đứng trước dấu hai chấm không phải tên kỹ năng.
        label, colon, rest = line.partition(':')
        if colon and rest.strip() and word_count(label) <= MAX_SKILL_LABEL_WORDS:
            line = rest
        for name in (part.strip() for part in _LIST_SEPARATORS.split(line)):
            if '/' in name and catalog.resolve(name) is None:
                names += [part.strip() for part in name.split('/')]
            else:
                names.append(name)
    return names


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
    experience, latest_titles, job_titles = _experience(layout, now)
    title = _title(layout, latest_titles, job_titles)
    if title:
        entries.insert(0, ('title', title))
    chunks = make_chunks(entries, MAX_CV_CHUNKS)
    return cv_profile_json(
        source='upload',
        language=detect_language(' '.join(chunk['text'] for chunk in chunks)),
        title=title,
        skills=cv_skills(
            catalog,
            declared_names=_declared_names(layout.section('skills'), catalog),
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
        position=facts.position_level(' | '.join([title, *latest_titles]), experience['months']),
        languages=facts.cv_languages(_language_lines(layout)),
        chunks=chunks,
        # Mỗi mục của tệp là một khối chữ theo thứ tự đọc. Phần đầu trang (tên, liên hệ),
        # thông tin cá nhân và người tham chiếu không đưa vào hồ sơ hiển thị.
        sections=make_sections(
            (section, display_item(lines=lines))
            for section, lines in layout.segments
            if section not in DISPLAY_SKIPPED_SECTIONS
        ),
    )
