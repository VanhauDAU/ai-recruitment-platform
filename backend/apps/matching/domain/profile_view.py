"""Hồ sơ trích xuất từ một CV, ở dạng được phép hiển thị (danh sách trắng trường).

`MatchDocument.profile_json` là đầu vào của bước chấm điểm và chứa cả chữ nguyên văn
của CV (`chunks`, câu bằng chứng). Chỉ các trường kể ra ở đây mới ra khỏi backend,
theo người xem:

| Trường | Chủ CV (`owner`) | NTD tìm kiếm (`recruiter_search`) |
| --- | --- | --- |
| Chức danh, kỹ năng theo nhóm, số tháng và mức kinh nghiệm, học vấn, cấp bậc, ngoại ngữ | có | có |
| Tên công ty ở từng việc đã làm | có | không (dễ lộ danh tính) |
| Dòng chữ nguyên văn của CV tải lên | có | không (chỉ số việc đã làm) |
| Câu bằng chứng, `chunks` | không | không |

Hàm thuần, không đọc DB: selectors (ứng viên xem hồ sơ của mình) và services (tìm ứng
viên cho nhà tuyển dụng) cùng dùng.
"""

OWNER = 'owner'
RECRUITER_SEARCH = 'recruiter_search'


def _skill_groups(skills):
    groups = {}
    for skill in skills:
        groups.setdefault(skill.get('group') or '', []).append(skill['name'])
    return [{'group': group, 'skills': names} for group, names in groups.items()]


def _experience_items(items, audience):
    """Việc đã làm: CV tạo trên hệ thống có vai trò/công ty/thời gian; CV tải lên chỉ có dòng chữ."""
    shown = []
    for item in items:
        if 'text' in item:
            if audience == OWNER:
                shown.append({'text': item['text']})
            continue
        row = {
            'role': item.get('role') or '',
            'start_date': item.get('start_date'),
            'end_date': item.get('end_date'),
        }
        if audience == OWNER:
            row['company'] = item.get('company') or ''
        shown.append(row)
    return shown


def public_cv_profile(profile, *, audience):
    """Các trường của `profile_json` được phép hiển thị cho `audience`."""
    experience = profile.get('experience') or {}
    items = experience.get('items') or []
    return {
        'source': profile.get('source', ''),
        'language': profile.get('language', ''),
        'title': profile.get('title', ''),
        'skill_groups': _skill_groups(profile.get('skills') or []),
        'experience': {
            'months': experience.get('months'),
            'band': experience.get('band', ''),
            'estimated': experience.get('basis') == 'whole_text',
            'item_count': len(items),
            'items': _experience_items(items, audience),
        },
        'education_level': (profile.get('education') or {}).get('level', ''),
        'position_level': profile.get('position_level', ''),
        'languages': [
            {'code': row['code'], 'level': row.get('level', '')}
            for row in profile.get('languages') or []
        ],
        'missing': (profile.get('quality') or {}).get('missing', []),
    }
