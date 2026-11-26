"""Năm tiêu chí của công thức `hybrid-v3`, mỗi tiêu chí cho điểm 0–100.

Tiêu chí trả `status`:
- `ok`: tính được, có điểm;
- `insufficient_data`: CV không ghi thông tin cần cho tiêu chí → bị loại khỏi
  điểm tổng (không đoán);
- `not_required`: tin không đặt yêu cầu cho tiêu chí này → bị loại khỏi điểm tổng.

| Tiêu chí | Cách tính |
| --- | --- |
| Kỹ năng | `Σ(w·m)/Σw` trên các đơn vị chấm; đơn vị là một kỹ năng đứng riêng hoặc một nhóm kỹ năng thay thế nhau ("một trong", "hoặc"; xem `skill_groups.py`); w = trọng số kỹ năng × (1 cần có / 0,5 nên có), m = 1 khi CV có kỹ năng (theo danh mục), với nhóm là có ít nhất một kỹ năng trong nhóm; khớp theo câu gần nghĩa chỉ bật khi `Calibration.semantic_skills` |
| Kinh nghiệm | `0,4·Y·R/100 + 0,6·R`; Y theo số năm (đủ 100, thiếu 1 bậc 60, thiếu ≥ 2 bậc 20); R = mức liên quan (trung bình điểm toàn văn và điểm chức danh, xem `semantic.py`). Y nhân R/100: năm làm việc khác nghề không được tính |
| Học vấn | Đủ hoặc vượt 100, thấp 1 bậc 50, thấp ≥ 2 bậc 0 |
| Cấp bậc | Lệch 0/1/2/≥3 bậc: 100/70/40/10, tính cả hai chiều |
| Ngoại ngữ | Đủ mức 100, thấp 1 bậc 50, thấp hơn hoặc không có 0 |

Địa điểm không phải tiêu chí chấm: CV không mang địa điểm (nơi làm việc mong muốn
nằm ở hồ sơ ứng viên), và rubric gán nhãn không xét địa điểm.
"""

from dataclasses import dataclass, field

from apps.cvs.services import EDUCATION_ORDER, months_to_experience_years
from apps.jobs.models import Job, JobLanguageRequirement

EXPERIENCE_BANDS = tuple(Job.ExperienceYears.values)
LANGUAGE_LEVELS = tuple(JobLanguageRequirement.ProficiencyLevel.values)
# Thứ tự cấp bậc từ thấp lên cao (khác thứ tự khai báo của `Job.PositionLevel`).
POSITION_ORDER = (
    'intern',
    'employee',
    'team_lead',
    'supervisor',
    'manager',
    'branch_manager',
    'vice_director',
    'director',
)
PREFERRED_SKILL_FACTOR = 0.5
# Câu CV dùng để đo độ phủ yêu cầu: phần kể việc đã làm. `other` là chữ chưa
# phân loại của PDF bố cục đảo.
EXPERIENCE_SECTIONS = ('experience', 'projects', 'summary', 'other')
YEARS_SCORE = {0: 100, 1: 60}  # thiếu bao nhiêu bậc → điểm; thiếu nhiều hơn → 20
YEARS_FLOOR = 20
POSITION_SCORE = {0: 100, 1: 70, 2: 40}  # lệch bao nhiêu bậc → điểm; lệch nhiều hơn → 10
POSITION_FLOOR = 10


@dataclass
class Component:
    key: str
    score: float | None = None
    status: str = 'ok'
    detail: dict = field(default_factory=dict)


@dataclass
class MatchInput:
    cv: dict
    job: dict
    calibration: object
    # Tên kỹ năng của tin → (cosine, câu CV gần nghĩa nhất).
    skill_hits: dict
    # Mức liên quan 0–100 (None nếu không so được) và chi tiết các phép so.
    relevance: float | None
    relevance_detail: dict
    # Có nhận kỹ năng viết khác tên qua câu gần nghĩa không (xem `Calibration`).
    semantic_skills: bool = False
    # Nhóm kỹ năng thay thế nhau của tin: [(skill_id, ...)] (xem `skill_groups.py`).
    skill_groups: tuple = ()


def _skill_match(data, skill, cv_skills):
    """Cách CV đáp ứng một kỹ năng của tin, hoặc None."""
    own = cv_skills.get(skill['skill_id'])
    if own is not None:
        return {'match_type': 'exact', 'similarity': None, 'evidence': own['evidence']}
    similarity, sentence = data.skill_hits.get(skill['name'], (0.0, ''))
    if data.semantic_skills and sentence and similarity >= data.calibration.skill:
        return {'match_type': 'semantic', 'similarity': similarity, 'evidence': sentence}
    return None


def skills(data):
    job_skills = [skill for skill in data.job['skills'] if skill['counted']]
    if not job_skills:
        return Component('skills', status='not_required')
    cv_skills = {skill['skill_id']: skill for skill in data.cv['skills']}
    # Đơn vị chấm: một kỹ năng đứng riêng, hoặc một nhóm kỹ năng thay thế nhau (số
    # thứ tự nhóm tính từ 1). Nhóm nặng bằng kỹ năng nặng nhất của nó và đạt khi CV
    # có ít nhất một kỹ năng trong nhóm.
    group_of = {
        skill_id: number
        for number, members in enumerate(data.skill_groups, start=1)
        for skill_id in members
    }
    weights, satisfied, rows = {}, set(), []
    for skill in job_skills:
        factor = 1.0 if skill['importance'] == 'required' else PREFERRED_SKILL_FACTOR
        group = group_of.get(skill['skill_id'])
        unit = ('group', group) if group else ('skill', skill['skill_id'])
        weights[unit] = max(weights.get(unit, 0.0), skill['weight'] * factor)
        match = _skill_match(data, skill, cv_skills)
        if match is not None:
            satisfied.add(unit)
        row = {'name': skill['name'], 'importance': skill['importance']}
        rows.append((unit, {**row, 'group': group} if group else row, match))
    total = sum(weights.values())
    earned = sum(weight for unit, weight in weights.items() if unit in satisfied)
    matched = [{**row, **match} for _, row, match in rows if match is not None]
    # Kỹ năng CV không có nhưng nhóm của nó đã đạt nhờ kỹ năng khác thì không phải là thiếu.
    missing = [row for unit, row, match in rows if match is None and unit not in satisfied]
    job_ids = {skill['skill_id'] for skill in data.job['skills']}
    extra = [
        skill['name']
        for skill in data.cv['skills']
        if skill['counted'] and skill['skill_id'] not in job_ids
    ]
    # Tin có yêu cầu kỹ năng mà CV không thể hiện thì là 0 điểm, không phải
    # "thiếu dữ liệu": chấm theo những gì CV viết.
    detail = {
        'matched': matched,
        'missing': missing,
        'extra': extra,
        'units': {'met': len(satisfied), 'total': len(weights)},
    }
    return Component('skills', 100 * earned / total, detail=detail)


def _years_score(job_band, months):
    if job_band in ('none', 'under_1'):
        return 100
    gap = EXPERIENCE_BANDS.index(job_band) - EXPERIENCE_BANDS.index(
        months_to_experience_years(months).value
    )
    return YEARS_SCORE.get(max(gap, 0), YEARS_FLOOR)


def experience(data):
    months, band = data.cv['experience']['months'], data.job['experience']['band']
    years = _years_score(band, months) if band and months is not None else None
    relevance = data.relevance
    # Số năm chỉ có nghĩa khi đúng loại công việc: Y được nhân với mức liên quan
    # R/100, nên bốn năm kế toán không đem lại điểm số năm cho tin lập trình.
    relevant_years = (
        years * relevance / 100 if years is not None and relevance is not None else years
    )
    parts = [(0.4, relevant_years), (0.6, relevance)]
    available = [(weight, value) for weight, value in parts if value is not None]
    detail = {
        'required_band': band,
        'cv_months': months,
        'basis': data.cv['experience'].get('basis', ''),
        'years_score': years,
        'relevance_score': None if relevance is None else round(relevance, 1),
        **data.relevance_detail,
    }
    if not available:
        return Component('experience', status='insufficient_data', detail=detail)
    score = sum(weight * value for weight, value in available) / sum(w for w, _ in available)
    return Component('experience', score, detail=detail)


def education(data):
    required, own = data.job['education']['level'], data.cv['education']['level']
    detail = {'required': required, 'cv': own}
    if not required:
        return Component('education', status='not_required', detail=detail)
    if required == 'none':
        return Component('education', 100, detail=detail)
    if not own:
        return Component('education', status='insufficient_data', detail=detail)
    gap = EDUCATION_ORDER.index(required) - EDUCATION_ORDER.index(own)
    return Component('education', {0: 100, 1: 50}.get(max(gap, 0), 0), detail=detail)


def position_level(data):
    required, own = data.job['position_level'], data.cv['position_level']
    detail = {'required': required, 'cv': own}
    if not required:
        return Component('position_level', status='not_required', detail=detail)
    if not own:
        return Component('position_level', status='insufficient_data', detail=detail)
    distance = abs(POSITION_ORDER.index(required) - POSITION_ORDER.index(own))
    return Component('position_level', POSITION_SCORE.get(distance, POSITION_FLOOR), detail=detail)


def _language_score(required_level, own):
    if own is None:
        return 0
    if not required_level:
        return 100
    if not own['level']:
        return 50  # CV có ngôn ngữ nhưng không ghi mức
    gap = LANGUAGE_LEVELS.index(required_level) - LANGUAGE_LEVELS.index(own['level'])
    return {0: 100, 1: 50}.get(max(gap, 0), 0)


def languages(data):
    requirements = data.job['languages']
    if not requirements:
        return Component('languages', status='not_required')
    own = {item['code']: item for item in data.cv['languages']}
    rows = []
    for requirement in requirements:
        score = _language_score(requirement['level'], own.get(requirement['code']))
        rows.append(
            {
                **requirement,
                'cv_level': own.get(requirement['code'], {}).get('level'),
                'score': score,
            }
        )
    weights = [1.0 if row['required'] else 0.5 for row in rows]
    score = sum(w * row['score'] for w, row in zip(weights, rows, strict=True)) / sum(weights)
    missing_required = [row for row in rows if row['required'] and row['score'] == 0]
    return Component(
        'languages', score, detail={'rows': rows, 'missing_required': missing_required}
    )


CRITERIA = (skills, experience, education, position_level, languages)
