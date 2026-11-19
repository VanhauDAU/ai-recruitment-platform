"""Chấm điểm một tin theo ngữ cảnh ứng viên bằng luật cố định, giải thích được."""

import re
from decimal import Decimal

from common.db.search import fold_accents

from ..core import Job
from ..details import JobCategoryAssignment

EXPERIENCE_RANK = {
    '': 0,
    'none': 0,
    'no_experience': 0,
    'under_1': 1,
    '1': 2,
    '2': 3,
    '3': 4,
    '4': 5,
    '5': 6,
    'over_5': 7,
}

# A job must have at least one strong CV signal (position/category) or several
# weaker signals (for example skills + location) before it is called suitable.
# This prevents a fresh but unrelated job from filling an otherwise short list.
MIN_RECOMMENDATION_SCORE = 20


def normalize_term(value):
    return fold_accents(str(value or '')).strip()


def _contains_term(text, terms):
    return any(term and (term in text or text in term) for term in terms)


def _has_semantic_token_overlap(text, labels):
    stop_words = {
        'developer',
        'engineer',
        'specialist',
        'staff',
        'nhan',
        'vien',
        'chuyen',
        'lap',
        'trinh',
        'ky',
        'su',
        'cong',
        'viec',
        'and',
        'the',
        'senior',
        'junior',
    }
    short_domain_tokens = {'ai', 'it', 'qa', 'hr', 'ui', 'ux'}

    def tokens(value):
        return {
            token
            for token in re.findall(r'[a-z0-9]+', normalize_term(value))
            if token not in stop_words and (len(token) >= 3 or token in short_domain_tokens)
        }

    title_tokens = tokens(text)
    return any(title_tokens & tokens(label) for label in labels)


def score_job(job, context):
    details = []

    def add_detail(code, label, points):
        details.append({'code': code, 'label': label, 'points': points})

    title = normalize_term(job.title)
    matching_primary_categories = [
        item
        for item in job.category_assignments.all()
        if item.role == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
        and item.category_id in context['category_ids']
    ]
    if matching_primary_categories and _has_semantic_token_overlap(
        title,
        [item.category.name for item in matching_primary_categories],
    ):
        add_detail('category', 'Đúng vị trí chuyên môn', 38)

    if _contains_term(title, context['position_terms']):
        add_detail('position', context['position_reason'], 24)

    job_skills = {normalize_term(item.skill.name) for item in job.job_skills.all()}
    matched_skills = sorted(context['skills'] & job_skills)
    if matched_skills:
        add_detail(
            'skills', f'Khớp {len(matched_skills)} kỹ năng', min(24, len(matched_skills) * 6)
        )

    provinces = {item.location.parent_id or item.location_id for item in job.job_locations.all()}
    if provinces & context['province_ids']:
        add_detail('location', 'Đúng địa điểm mong muốn', 10)
    elif provinces and context['willing_to_relocate']:
        add_detail('relocation', 'Phù hợp với lựa chọn sẵn sàng chuyển địa điểm', 3)

    candidate_experience = EXPERIENCE_RANK.get(context['experience_level'], 0)
    required_experience = EXPERIENCE_RANK.get(job.experience_years, 0)
    if job.experience_years and candidate_experience >= required_experience:
        add_detail('experience', 'Kinh nghiệm phù hợp', 6)

    desired_salary = context['desired_salary']
    if job.salary_type != Job.SalaryType.NEGOTIABLE and job.currency == 'VND' and desired_salary:
        desired = Decimal(desired_salary)
        if job.salary_type == Job.SalaryType.FROM:
            lower, upper = job.salary_min or Decimal('0'), None
        elif job.salary_type == Job.SalaryType.UP_TO:
            lower, upper = Decimal('0'), job.salary_max
        else:
            lower = job.salary_min or job.salary_max or Decimal('0')
            upper = job.salary_max or job.salary_min
        if lower <= desired * Decimal('1.25') and (
            upper is None or upper >= desired * Decimal('0.8')
        ):
            add_detail('salary', 'Mức lương phù hợp', 8)

    # Paid tier is intentionally excluded from compatibility. It is only a
    # deterministic tie-breaker below and can never make an unrelated job fit.
    score = min(sum(item['points'] for item in details), 100)
    return score, details


def presentation_match_reasons(details):
    codes = {item['code'] for item in details}
    reasons = []
    if codes & {'category', 'position'}:
        reasons.append('Phù hợp với tìm kiếm của bạn')
    if 'skills' in codes:
        reasons.append('Phù hợp với kỹ năng của bạn')
    return reasons
