"""Hồ sơ trích xuất từ một CV, ở dạng được phép hiển thị.

`MatchDocument.profile_json` là đầu vào của bước chấm điểm và chứa cả chữ nguyên văn
của CV (`chunks`, câu bằng chứng). Module này là **danh sách trắng**: chỉ các trường kể
ra ở đây mới ra khỏi backend, theo người xem:

| Trường | Chủ CV (`owner`) | NTD tìm kiếm (`recruiter_search`) |
| --- | --- | --- |
| Chức danh, kỹ năng theo nhóm, số tháng và mức kinh nghiệm, học vấn, cấp bậc, ngoại ngữ | có | có |
| Tên công ty ở từng việc đã làm | có | không (dễ lộ danh tính) |
| Dòng chữ nguyên văn của CV tải lên | có | không (chỉ số việc đã làm) |
| Câu bằng chứng, `chunks` | không | không |

Hồ sơ chỉ đọc: sai thì sửa CV, vì điểm phù hợp được giải thích bằng chính nội dung CV.
"""

from ..domain import EXTRACTOR_VERSION, model_version
from ..models import MatchDocument

OWNER = 'owner'
RECRUITER_SEARCH = 'recruiter_search'


def cv_profile_document(cv):
    """Tài liệu hiện hành của phiên bản mới nhất của CV, kể cả bản trích xuất lỗi; None nếu chưa có."""
    return (
        MatchDocument.objects.filter(
            kind=MatchDocument.Kind.CV,
            cv_version_id=cv.latest_version_id,
            is_current=True,
            extractor_version=EXTRACTOR_VERSION,
            model_version=model_version(),
        )
        .order_by('-pk')
        .first()
    )


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


def owner_cv_profile(cv):
    """Hồ sơ trích xuất của CV cho chính chủ: `{status, error_code, profile}`.

    `pending`: CV vừa lưu, chưa trích xuất xong. `failed`: không đọc được CV (ví dụ PDF
    scan), kèm mã lỗi. `ready`: có `profile`.
    """
    document = cv_profile_document(cv)
    if document is None:
        return {'status': 'pending', 'error_code': '', 'profile': None}
    if document.status != MatchDocument.Status.READY:
        return {'status': 'failed', 'error_code': document.error_code, 'profile': None}
    return {
        'status': 'ready',
        'error_code': '',
        'profile': public_cv_profile(document.profile_json, audience=OWNER),
    }
