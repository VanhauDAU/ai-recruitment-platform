"""Đọc thông tin có cấu trúc từ dòng chữ: khoảng ngày, bậc học, cấp bậc, ngoại ngữ.

Mọi hàm chỉ nhận điều văn bản ghi rõ (từ khóa, chứng chỉ, ngày tháng). Không
thấy thì trả rỗng/None để bước sau đánh dấu `insufficient_data`.
"""

import re

from apps.cvs.services import EDUCATION_ORDER
from apps.jobs.models import Job, JobLanguageRequirement

from .text import normalize_text

LANGUAGE_LEVELS = tuple(JobLanguageRequirement.ProficiencyLevel.values)
POSITION = Job.PositionLevel


def _folded(text):
    return normalize_text(text).casefold()


def _has_any(folded, words):
    return any(word in folded for word in words)


# ---------------------------------------------------------------- khoảng ngày

# Một mốc thời gian: 03/2021, 3-2021, 2021-03, Sep 2021, Tháng 9/2021 hoặc 2021.
_MONTH_NAMES = ('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec')
_YEAR = r'(?:19|20)\d{2}'
_DATE = (
    rf'(?<![\w/.\-])(?:'
    rf'(?:tháng\s*)?\d{{1,2}}[/.\-]{_YEAR}'
    rf'|{_YEAR}[/.\-]\d{{1,2}}(?!\d)'
    rf'|(?:{"|".join(_MONTH_NAMES)})[a-z]*\.?\s+{_YEAR}'
    rf'|{_YEAR})(?!\d)'
)
_NOW = r'nay|hiện tại|hiện nay|present|now|current|today'
# Dấu nối có thể mất khi mẫu CV vẽ nó bằng icon, nên khoảng trắng cũng là dấu nối.
_RANGE = re.compile(
    rf'({_DATE})\s*(?:-|–|—|~|→|>|»|đến|to|until|\s)\s*({_DATE}|{_NOW})', re.IGNORECASE
)
_DATE_ONLY = re.compile(rf'\s*({_DATE})\s*', re.IGNORECASE)


def _month(value, *, end):
    """Mốc thời gian → số tháng tuyệt đối; chỉ có năm thì lấy tháng 1 (đầu) hoặc 12 (cuối)."""
    folded = value.casefold().replace('tháng', '').strip()
    named = [order for order, month in enumerate(_MONTH_NAMES, 1) if folded.startswith(month)]
    if named:
        return int(re.search(_YEAR, folded).group()) * 12 + named[0] - 1
    parts = [int(part) for part in re.split(r'[/.\-]', folded)]
    if len(parts) == 1:
        year, month = parts[0], 12 if end else 1
    elif parts[0] > 12:
        year, month = parts
    else:
        month, year = parts
    month = month if 1 <= month <= 12 else (12 if end else 1)
    return year * 12 + month - 1


def has_date(line):
    return re.search(_DATE, line, re.IGNORECASE) is not None


def date_ranges(line, now):
    """Các khoảng (tháng đầu, tháng cuối) ghi trong một dòng; "nay"/"present" là `now`."""
    ranges = []
    for start, end in _RANGE.findall(line):
        finish = now if re.fullmatch(_NOW, end, re.IGNORECASE) else _month(end, end=True)
        ranges.append((_month(start, end=False), finish))
    return ranges


def open_start_date(line):
    """Dòng chỉ ghi một mốc bắt đầu (mẫu CV in việc đang làm là "2026-03"); tháng hoặc None."""
    match = _DATE_ONLY.fullmatch(line)
    return _month(match.group(1), end=False) if match else None


# ---------------------------------------------------------------- học vấn

# Từ chỉ bằng cấp được ưu tiên hơn tên trường: "Cao đẳng … — Trường Đại học X"
# là bậc cao đẳng. Chỉ khi không có từ chỉ bằng cấp mới xét tên trường.
_DEGREE_WORDS = (
    ('postgraduate', ('thạc sĩ', 'tiến sĩ', 'cao học', 'master', 'mba', 'phd')),
    ('university', ('cử nhân', 'kỹ sư', 'bachelor')),
    ('college', ('cao đẳng', 'associate degree')),
    ('intermediate', ('trung cấp', 'vocational')),
    ('high_school', ('thpt', 'trung học phổ thông', 'high school')),
)
_INSTITUTION_WORDS = (
    ('university', ('đại học', 'university')),
    ('college', ('college',)),
)


def education_level(text):
    """Bậc học cao nhất văn bản ghi rõ (`Job.EducationLevel`); rỗng nếu không ghi."""
    folded = _folded(text)
    for table in (_DEGREE_WORDS, _INSTITUTION_WORDS):
        levels = [level for level, words in table if _has_any(folded, words)]
        if levels:
            return max(levels, key=EDUCATION_ORDER.index)
    return ''


# Từ cho biết một dòng nói về nơi học, để tách dòng ngày học khỏi dòng ngày đi làm.
# Không gồm "kỹ sư" (cũng là chức danh) và "trường" (có trong "thị trường").
_SCHOOL_WORDS = (
    'đại học', 'cao đẳng', 'trung cấp', 'thpt', 'trung học', 'học viện',
    'cử nhân', 'thạc sĩ', 'tiến sĩ', 'sinh viên',
    'university', 'student', 'college', 'academy', 'institute', 'school', 'bachelor', 'master', 'phd', 'mba',
)  # fmt: skip


def mentions_school(text):
    return _has_any(_folded(text), _SCHOOL_WORDS)


# ---------------------------------------------------------------- cấp bậc

# Chỉ từ khóa chức danh rõ nghĩa. "Manager" một mình (Project/Account Manager)
# thường là vị trí chuyên môn chứ không phải cấp quản lý nên không tính.
_POSITION_WORDS = (
    (
        POSITION.VICE_DIRECTOR,
        ('phó giám đốc', 'deputy director', 'vice director', 'vice president'),
    ),
    (POSITION.DIRECTOR, ('giám đốc', 'director', 'ceo', 'cto', 'cfo', 'coo', 'head of')),
    (POSITION.BRANCH_MANAGER, ('trưởng chi nhánh', 'branch manager')),
    (POSITION.MANAGER, ('trưởng phòng', 'phó phòng', 'department manager')),
    (POSITION.SUPERVISOR, ('giám sát', 'supervisor')),
    (POSITION.TEAM_LEAD, ('trưởng nhóm', 'team lead', 'team leader', 'tech lead', 'leader')),
    (POSITION.INTERN, ('thực tập', 'intern', 'trainee')),
)


# "Thư ký Tổng Giám đốc", "Trợ lý Trưởng phòng" là nhân viên, không phải cấp quản lý.
_ASSISTANT_WORDS = ('thư ký', 'trợ lý', 'assistant', 'secretary')


def _mentions(folded, words):
    return any(re.search(rf'(?<!\w){re.escape(word)}(?!\w)', folded) for word in words)


def position_level(title, months):
    """Cấp bậc theo chức danh; chức danh không có từ khóa mà đã đi làm là Nhân viên.

    Chưa có kinh nghiệm và chức danh không nói rõ thì trả rỗng (không đoán).
    """
    folded = _folded(title)
    if _mentions(folded, _ASSISTANT_WORDS):
        return POSITION.EMPLOYEE.value
    for level, words in _POSITION_WORDS:
        if _mentions(folded, words):
            return level.value
    return POSITION.EMPLOYEE.value if months else ''


# ---------------------------------------------------------------- ngoại ngữ

# Mã theo bảng `jobs.Language`; tên chứng chỉ cũng cho biết ngôn ngữ.
_LANGUAGE_NAMES = {
    'en': ('tiếng anh', 'english', 'ielts', 'toeic', 'toefl'),
    'ja': ('tiếng nhật', 'japanese', 'jlpt'),
    'ko': ('tiếng hàn', 'korean', 'topik'),
    'zh': ('tiếng trung', 'chinese', 'mandarin', 'hsk'),
    'fr': ('tiếng pháp', 'french', 'delf', 'dalf'),
    'vi': ('tiếng việt', 'vietnamese'),
}
_LEVEL_WORDS = (
    ('native', ('bản ngữ', 'native', 'mother tongue')),
    (
        'professional',
        ('thành thạo', 'lưu loát', 'fluent', 'proficient', 'professional', 'advanced'),
    ),
    ('working', ('làm việc', 'working', 'intermediate', 'trung cấp')),
    ('conversational', ('giao tiếp', 'conversational', 'communication')),
    ('basic', ('cơ bản', 'basic', 'beginner', 'elementary', 'sơ cấp')),
)
# Chứng chỉ có điểm: (mẫu, [(điểm tối thiểu, mức)]) — dưới mọi ngưỡng là `basic`.
_SCORED_CERTIFICATES = (
    (
        r'ielts\D{0,10}(\d(?:[.,]\d)?)',
        ((7, 'professional'), (5.5, 'working'), (4, 'conversational')),
    ),
    (r'toeic\D{0,10}(\d{3})', ((850, 'professional'), (600, 'working'), (450, 'conversational'))),
    (r'toefl\D{0,10}(\d{2,3})', ((95, 'professional'), (72, 'working'), (45, 'conversational'))),
)
# Chứng chỉ theo cấp: (mẫu, {cấp: mức}).
_GRADED_CERTIFICATES = (
    (r'jlpt\D{0,5}n?([1-5])', {'1': 'professional', '2': 'professional', '3': 'working', '4': 'conversational', '5': 'basic'}),
    (r'topik\D{0,5}([1-6])', {'6': 'professional', '5': 'professional', '4': 'working', '3': 'working', '2': 'conversational', '1': 'basic'}),
    (r'hsk\D{0,5}([1-6])', {'6': 'professional', '5': 'professional', '4': 'working', '3': 'conversational', '2': 'basic', '1': 'basic'}),
)  # fmt: skip


def language_codes(text):
    folded = _folded(text)
    return [code for code, names in _LANGUAGE_NAMES.items() if _has_any(folded, names)]


def level_rank(level):
    return LANGUAGE_LEVELS.index(level) if level in LANGUAGE_LEVELS else -1


def language_level(text):
    """Mức `JobLanguageRequirement.ProficiencyLevel` cao nhất dòng chữ ghi rõ; rỗng nếu không ghi."""
    folded = _folded(text)
    levels = [level for level, words in _LEVEL_WORDS if _has_any(folded, words)]
    for pattern, thresholds in _SCORED_CERTIFICATES:
        for score in re.findall(pattern, folded):
            score = float(score.replace(',', '.'))
            levels.append(
                next((level for minimum, level in thresholds if score >= minimum), 'basic')
            )
    for pattern, grades in _GRADED_CERTIFICATES:
        levels += [grades[grade] for grade in re.findall(pattern, folded)]
    return max(levels, key=level_rank, default='')


def cv_languages(lines):
    """[{code, level, evidence}] từ các dòng ngoại ngữ; mỗi ngôn ngữ giữ mức cao nhất."""
    found = {}
    for line in lines:
        for code in language_codes(line):
            entry = {'code': code, 'level': language_level(line), 'evidence': line}
            if code not in found or level_rank(entry['level']) > level_rank(found[code]['level']):
                found[code] = entry
    return list(found.values())
