"""Dữ liệu matching dẫn xuất từ document CV (CVT-1c, kế hoạch CVT-v3 mục 5.6).

CV và tin tuyển dụng dùng chung từ vựng: số năm kinh nghiệm của CV là một giá
trị của `Job.ExperienceYears`, tính từ ngày bắt đầu/kết thúc các mục kinh
nghiệm (gộp khoảng chồng lấn, mục chưa kết thúc tính tới tháng hiện tại).
"""

from datetime import date

from apps.jobs.models import Job

from ..models import UserCv


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
    for section in content_json.get('sections', []):
        if not isinstance(section, dict) or section.get('section_key') != 'experience':
            continue
        if not section.get('enabled', True):
            continue
        for item in section.get('items', []):
            if not isinstance(item, dict):
                continue
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


def sync_matching_profile(cv, content_json):
    """Cập nhật trường matching của CV theo document vừa lưu thành version."""
    value = experience_years(content_json)
    if cv.experience_years != value:
        UserCv.objects.filter(pk=cv.pk).update(experience_years=value)
        cv.experience_years = value
