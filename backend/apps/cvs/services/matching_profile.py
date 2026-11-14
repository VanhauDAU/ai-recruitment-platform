"""Dữ liệu matching dẫn xuất từ document CV (CVT-1c, CVT-3; kế hoạch CVT-v3 mục 5.6).

CV và tin tuyển dụng dùng chung từ vựng:

- số năm kinh nghiệm là một giá trị `Job.ExperienceYears`, tính từ ngày bắt
  đầu/kết thúc các mục kinh nghiệm (gộp khoảng chồng lấn, mục chưa kết thúc tính
  tới tháng hiện tại);
- bậc học là `Job.EducationLevel` cao nhất trong mục học vấn (`degree_level`);
- kỹ năng là `CvSkill` trỏ tới taxonomy `skills.Skill` (cùng bảng với
  `JobSkill`), lấy từ mục kỹ năng và trường riêng đánh dấu `maps_to=skills`;
  tên không có trong taxonomy được bỏ qua, không tự tạo kỹ năng mới.

Cấp bậc mong muốn (`Job.PositionLevel`) do ứng viên chọn, không suy từ document.
"""

from datetime import date

from apps.jobs.models import Job
from apps.skills.selectors import normalize_skill_name, skills_by_names

from ..models import CvSkill, UserCv

EDUCATION_ORDER = tuple(Job.EducationLevel.values)
# Mức 1–5 của editor → mức của `JobSkill.min_level`.
SKILL_LEVELS = {
    1: CvSkill.Level.BEGINNER,
    2: CvSkill.Level.BEGINNER,
    3: CvSkill.Level.INTERMEDIATE,
    4: CvSkill.Level.ADVANCED,
    5: CvSkill.Level.ADVANCED,
}


def _enabled_items(content_json, section_key):
    for section in content_json.get('sections', []):
        if (
            isinstance(section, dict)
            and section.get('section_key') == section_key
            and section.get('enabled', True)
        ):
            yield from (item for item in section.get('items', []) if isinstance(item, dict))


def _month_index(value):
    """`'YYYY-MM'` → số tháng tuyệt đối; `None` nếu sai định dạng."""
    try:
        year, month = (int(part) for part in str(value).split('-')[:2])
    except ValueError:
        return None
    return year * 12 + month - 1 if 1 <= month <= 12 else None


def experience_months(content_json, today=None):
    today = today or date.today()
    now = today.year * 12 + today.month - 1
    ranges = []
    for item in _enabled_items(content_json, 'experience'):
        start = _month_index(item.get('start_date'))
        end = _month_index(item['end_date']) if item.get('end_date') else now
        if start is None or end is None or start > now or end < start:
            continue
        ranges.append((start, min(end, now)))

    total = 0
    current = None
    for start, end in sorted(ranges):
        if current and start <= current[1] + 1:
            current = (current[0], max(current[1], end))
            continue
        if current:
            total += current[1] - current[0] + 1
        current = (start, end)
    if current:
        total += current[1] - current[0] + 1
    return total


def experience_years(content_json, today=None):
    """Giá trị `Job.ExperienceYears` tương ứng tổng thời gian kinh nghiệm."""
    months = experience_months(content_json, today)
    if months == 0:
        return Job.ExperienceYears.NONE
    if months < 12:
        return Job.ExperienceYears.UNDER_1
    years = months // 12
    return Job.ExperienceYears.OVER_5 if years > 5 else Job.ExperienceYears(str(years))


def education_level(content_json):
    """`Job.EducationLevel` cao nhất trong các mục học vấn đang bật; rỗng nếu chưa khai."""
    levels = [
        item.get('degree_level')
        for item in _enabled_items(content_json, 'education')
        if item.get('degree_level') in EDUCATION_ORDER
    ]
    return max(levels, key=EDUCATION_ORDER.index, default='')


def declared_skills(content_json):
    """Tên chuẩn hóa → (tên, mức `CvSkill.Level` hoặc rỗng) từ mục kỹ năng và trường riêng."""
    declared = {}
    for item in _enabled_items(content_json, 'skills'):
        name = item.get('name')
        if isinstance(name, str) and name.strip():
            level = item.get('level')
            declared[normalize_skill_name(name)] = (name, SKILL_LEVELS.get(level, ''))
    for item in _enabled_items(content_json, 'position_details'):
        if item.get('maps_to') != 'skills' or not isinstance(item.get('value'), list):
            continue
        for name in item['value']:
            declared.setdefault(normalize_skill_name(name), (name, ''))
    return declared


def _sync_cv_skills(cv, content_json):
    declared = declared_skills(content_json)
    matched = skills_by_names([name for name, _ in declared.values()])
    wanted = {matched[key].pk: level for key, (_, level) in declared.items() if key in matched}
    current = {row.skill_id: row for row in cv.cv_skills.filter(source=CvSkill.Source.MANUAL)}
    stale = [row.pk for skill_id, row in current.items() if skill_id not in wanted]
    if stale:
        CvSkill.objects.filter(pk__in=stale).delete()
    changed = []
    for skill_id, level in wanted.items():
        row = current.get(skill_id)
        if row is not None and row.level != level:
            row.level = level
            changed.append(row)
    if changed:
        CvSkill.objects.bulk_update(changed, ['level'])
    missing = [
        CvSkill(cv=cv, skill_id=skill_id, level=level, source=CvSkill.Source.MANUAL)
        for skill_id, level in wanted.items()
        if skill_id not in current
    ]
    if missing:
        CvSkill.objects.bulk_create(missing, ignore_conflicts=True)


def sync_matching_profile(cv, content_json):
    """Cập nhật trường matching của CV theo document vừa lưu thành version."""
    values = {
        'experience_years': experience_years(content_json),
        'education_level': education_level(content_json),
    }
    changed = {field: value for field, value in values.items() if getattr(cv, field) != value}
    if changed:
        UserCv.objects.filter(pk=cv.pk).update(**changed)
        for field, value in changed.items():
            setattr(cv, field, value)
    _sync_cv_skills(cv, content_json)
