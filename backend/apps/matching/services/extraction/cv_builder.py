"""CV dựng bằng CV builder (`CvVersion.content_json`) → `profile_json`.

Document đã có cấu trúc (mục kinh nghiệm có ngày, học vấn có bậc, kỹ năng là
danh sách), nên chỉ đọc lại các trường đó; số tháng kinh nghiệm và bậc học dùng
cùng hàm với trường matching của CV (`apps.cvs.services`).
"""

from apps.cvs.services import declared_skills, enabled_items, experience_months
from apps.cvs.services import education_level as declared_education
from common.vietnam_time import vietnam_today

from ..skills import cv_skills
from . import facts
from .profile import MAX_CV_CHUNKS, cv_profile_json, display_item, make_chunks, make_sections
from .text import detect_language, join_parts, plain_text, split_sentences


def _field(item, key):
    return str(item.get(key) or '').strip()


def _item_entries(section, heading, description):
    return [(section, heading)] + [
        (section, line) for line in split_sentences(plain_text(description))
    ]


def _lines(value):
    """Các dòng của một ô mô tả (rich text), giữ từng gạch đầu dòng như ứng viên viết."""
    return [line.strip() for line in plain_text(value).split('\n') if line.strip()]


def _display_blocks(content_json):
    """Nội dung CV theo mục để hiển thị: mỗi công việc, bằng cấp, dự án là một mục con."""
    blocks = []
    for item in enabled_items(content_json, 'summary'):
        blocks.append(('summary', display_item(lines=_lines(item.get('value')))))
    for item in enabled_items(content_json, 'experience'):
        blocks.append(
            (
                'experience',
                display_item(
                    title=_field(item, 'role'),
                    subtitle=_field(item, 'company'),
                    start=item.get('start_date'),
                    end=item.get('end_date'),
                    lines=_lines(item.get('description')),
                ),
            )
        )
    for item in enabled_items(content_json, 'projects'):
        blocks.append(
            (
                'projects',
                display_item(
                    title=_field(item, 'name'),
                    subtitle=_field(item, 'role') or _field(item, 'value'),
                    start=item.get('start_date'),
                    end=item.get('end_date'),
                    lines=_lines(item.get('description')),
                ),
            )
        )
    for item in enabled_items(content_json, 'education'):
        blocks.append(
            (
                'education',
                display_item(
                    title=_field(item, 'degree'),
                    subtitle=_field(item, 'institution'),
                    start=item.get('start_date'),
                    end=item.get('end_date'),
                    lines=_lines(item.get('description')),
                ),
            )
        )
    for section in ('certifications', 'awards', 'activities'):
        for item in enabled_items(content_json, section):
            blocks.append(
                (
                    section,
                    display_item(
                        title=_field(item, 'name'),
                        subtitle=_field(item, 'value'),
                        lines=_lines(item.get('description')),
                    ),
                )
            )
    declared = [name for name, _ in declared_skills(content_json).values()]
    if declared:
        blocks.append(('skills', display_item(lines=[', '.join(declared)])))
    for item in enabled_items(content_json, 'languages'):
        blocks.append(
            ('languages', display_item(title=_field(item, 'name'), subtitle=_field(item, 'value')))
        )
    for item in enabled_items(content_json, 'interests'):
        blocks.append(
            (
                'interests',
                display_item(
                    title=_field(item, 'name'),
                    lines=_lines(item.get('value')) + _lines(item.get('description')),
                ),
            )
        )
    return blocks


def _latest_role(experience_items):
    """Chức danh của việc đang làm, hoặc việc kết thúc gần nhất."""
    latest = max(
        experience_items,
        key=lambda item: (not item['end_date'], str(item['end_date'] or ''), str(item['start_date'] or '')),
        default=None,
    )  # fmt: skip
    return latest['role'] if latest else ''


def cv_profile(content_json, catalog, *, today=None):
    today = today or vietnam_today()
    headline = _field(content_json.get('personal_info') or {}, 'headline')
    entries = []
    for item in enabled_items(content_json, 'summary'):
        entries += [('summary', line) for line in split_sentences(plain_text(item.get('value')))]

    experience_items = []
    for item in enabled_items(content_json, 'experience'):
        role, company = _field(item, 'role'), _field(item, 'company')
        experience_items.append(
            {
                'role': role,
                'company': company,
                'start_date': item.get('start_date'),
                'end_date': item.get('end_date'),
            }
        )
        entries += _item_entries('experience', join_parts(role, company), item.get('description'))
    for item in enabled_items(content_json, 'projects'):
        heading = join_parts(_field(item, 'name'), _field(item, 'role'))
        entries += _item_entries('projects', heading, item.get('description'))
    education_lines = []
    for item in enabled_items(content_json, 'education'):
        heading = join_parts(_field(item, 'degree'), _field(item, 'institution'))
        education_lines.append(heading)
        entries += _item_entries('education', heading, item.get('description'))
    for section in ('certifications', 'awards', 'activities'):
        for item in enabled_items(content_json, section):
            heading = join_parts(_field(item, 'name'), _field(item, 'value'))
            entries += _item_entries(section, heading, item.get('description'))

    declared = [name for name, _ in declared_skills(content_json).values()]
    if declared:
        entries.append(('skills', ', '.join(declared)))
    language_lines = [
        join_parts(_field(item, 'name'), _field(item, 'value'), separator=': ')
        for item in enabled_items(content_json, 'languages')
    ]
    entries += [('languages', line) for line in language_lines]

    # Không có mục kinh nghiệm nào là CV ghi rõ chưa đi làm (0 tháng); có mục mà
    # không có ngày thì không xác định được (None).
    has_dates = any(item['start_date'] for item in experience_items)
    if not experience_items:
        months, basis = 0, 'no_experience'
    elif has_dates:
        months, basis = experience_months(content_json, today), 'dates'
    else:
        months, basis = None, ''
    education = declared_education(content_json) or facts.education_level(
        '\n'.join(education_lines)
    )
    role = _latest_role(experience_items)
    # Chức danh là phép so mạnh nhất với tiêu đề tin (xem scoring/semantic.py).
    if headline or role:
        entries.insert(0, ('title', headline or role))
    chunks = make_chunks(entries, MAX_CV_CHUNKS)
    return cv_profile_json(
        source='builder',
        language=_field(content_json, 'locale')[:2].lower()
        or detect_language(' '.join(chunk['text'] for chunk in chunks)),
        title=headline or role,
        skills=cv_skills(
            catalog,
            declared_names=declared,
            # Mục ngoại ngữ không phải bằng chứng kỹ năng ("Tiếng Anh: Giao tiếp").
            sentences=[text for section, text in entries if section not in ('skills', 'languages')],
        ),
        experience={
            'months': months,
            'basis': basis,
            'items': experience_items,
        },
        education=education,
        position=facts.position_level(join_parts(role, headline), months),
        languages=facts.cv_languages(language_lines),
        chunks=chunks,
        sections=make_sections(_display_blocks(content_json)),
    )
