"""Hồ sơ trích xuất từ một CV, ở dạng được phép hiển thị (danh sách trắng trường).

`MatchDocument.profile_json` là đầu vào của bước chấm điểm và chứa cả chữ nguyên văn
của CV (`chunks`, câu bằng chứng). Chỉ các trường kể ra ở đây mới ra khỏi backend,
theo người xem:

| Trường | Chủ CV (`owner`) | NTD tìm kiếm (`recruiter_search`) |
| --- | --- | --- |
| Chức danh, kỹ năng theo nhóm, số tháng và mức kinh nghiệm, học vấn, cấp bậc, ngoại ngữ | có | có |
| Nội dung từng mục của CV (`sections`: tóm tắt, từng công việc kèm mô tả, dự án, học vấn, kỹ năng, chứng chỉ, giải thưởng, hoạt động, ngoại ngữ) | có | có |
| Mục `other` của CV tải lên (chữ không xếp được vào mục nào, có thể lẫn thông tin cá nhân) | có | không |
| Câu bằng chứng, `chunks` | không | không |

Email và số điện thoại đã bị bỏ ngay khi trích xuất (`make_sections`); phần đầu trang,
thông tin cá nhân và người tham chiếu của CV tải lên không được đưa vào `sections`. Tên
ứng viên có thể xuất hiện trong câu văn, nên bên trả kết quả cho nhà tuyển dụng tìm kiếm
còn che họ tên bằng `redact_name`.

Hàm thuần, không đọc DB: selectors (ứng viên và nhà tuyển dụng xem hồ sơ của một CV cụ
thể) và services (tìm ứng viên) cùng dùng.
"""

OWNER = 'owner'
RECRUITER_SEARCH = 'recruiter_search'
REDACTED_NAME = '[ứng viên]'


def _skill_groups(skills):
    groups = {}
    for skill in skills:
        groups.setdefault(skill.get('group') or '', []).append(skill['name'])
    return [{'group': group, 'skills': names} for group, names in groups.items()]


def _sections(profile, audience):
    hidden = ('other',) if audience == RECRUITER_SEARCH else ()
    return [section for section in profile.get('sections') or [] if section['key'] not in hidden]


def public_cv_profile(profile, *, audience):
    """Các trường của `profile_json` được phép hiển thị cho `audience`."""
    experience = profile.get('experience') or {}
    return {
        'source': profile.get('source', ''),
        'language': profile.get('language', ''),
        'title': profile.get('title', ''),
        'skill_groups': _skill_groups(profile.get('skills') or []),
        'experience': {
            'months': experience.get('months'),
            'band': experience.get('band', ''),
            'estimated': experience.get('basis') == 'whole_text',
            'item_count': len(experience.get('items') or []),
        },
        'education_level': (profile.get('education') or {}).get('level', ''),
        'position_level': profile.get('position_level', ''),
        'languages': [
            {'code': row['code'], 'level': row.get('level', '')}
            for row in profile.get('languages') or []
        ],
        'sections': _sections(profile, audience),
        'missing': (profile.get('quality') or {}).get('missing', []),
    }


def redact_name(shown, full_name):
    """Che họ tên ứng viên trong mọi dòng chữ của hồ sơ đã lọc bằng `public_cv_profile`."""
    name = ' '.join((full_name or '').split())
    if len(name) < 4:
        return shown
    target = name.casefold()

    def clean(text):
        lowered, parts, cursor = text.casefold(), [], 0
        # `casefold` có thể đổi độ dài chuỗi với vài ký tự hiếm; khi đó giữ nguyên dòng.
        if len(lowered) != len(text):
            return text
        while (found := lowered.find(target, cursor)) != -1:
            parts += [text[cursor:found], REDACTED_NAME]
            cursor = found + len(target)
        return ''.join(parts) + text[cursor:]

    sections = [
        {
            **section,
            'items': [
                {
                    **item,
                    'title': clean(item['title']),
                    'subtitle': clean(item['subtitle']),
                    'lines': [clean(line) for line in item['lines']],
                }
                for item in section['items']
            ],
        }
        for section in shown['sections']
    ]
    return {**shown, 'title': clean(shown['title']), 'sections': sections}
