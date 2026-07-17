"""Deterministic CV-to-job ranking used immediately after a candidate saves."""

from decimal import Decimal
import re

from common.db.search import fold_accents
from apps.candidates.selectors import candidate_job_preference_for_user
from apps.cvs.selectors import candidate_cv_by_public_id

from ..models import Job, JobCategoryAssignment
from .listing import active_jobs_queryset


EXPERIENCE_RANK = {
    '': 0, 'none': 0, 'no_experience': 0, 'under_1': 1,
    '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, 'over_5': 7,
}

# A job must have at least one strong CV signal (position/category) or several
# weaker signals (for example skills + location) before it is called suitable.
# This prevents a fresh but unrelated job from filling an otherwise short list.
MIN_RECOMMENDATION_SCORE = 20


def _normalized(value):
    return fold_accents(str(value or '')).strip()


def _contains_term(text, terms):
    return any(term and (term in text or text in term) for term in terms)


def _has_semantic_token_overlap(text, labels):
    stop_words = {
        'developer', 'engineer', 'specialist', 'staff', 'nhan', 'vien', 'chuyen',
        'lap', 'trinh', 'ky', 'su', 'cong', 'viec', 'and', 'the', 'senior', 'junior',
    }
    short_domain_tokens = {'ai', 'it', 'qa', 'hr', 'ui', 'ux'}

    def tokens(value):
        return {
            token for token in re.findall(r'[a-z0-9]+', _normalized(value))
            if token not in stop_words and (len(token) >= 3 or token in short_domain_tokens)
        }

    title_tokens = tokens(text)
    return any(title_tokens & tokens(label) for label in labels)


def _position_from_cv_title(title):
    """Use a descriptive CV title only when structured position data is absent."""
    value = re.sub(r'^cv(?:\s+của)?\s+', '', str(title or '').strip(), flags=re.IGNORECASE)
    return value if value and value != str(title or '').strip() else ''


def _cv_context(user, public_id):
    cv = candidate_cv_by_public_id(user, public_id)
    preference = candidate_job_preference_for_user(user)
    version = cv.latest_version
    content = version.content_json if version else (cv.cv_data or {})
    personal = content.get('personal_info', {}) if isinstance(content, dict) else {}
    headline = str(personal.get('headline') or personal.get('job_title') or '').strip()

    skills = {_normalized(item.skill.name) for item in cv.cv_skills.all() if item.skill_id}
    for section in content.get('sections', []) if isinstance(content, dict) else []:
        if not isinstance(section, dict) or section.get('section_key') != 'skills':
            continue
        for item in section.get('items', []):
            if isinstance(item, dict) and item.get('name'):
                skills.add(_normalized(item['name']))

    desired_categories = list(preference.desired_specializations.all())
    title_position = _position_from_cv_title(cv.title)

    # This endpoint explains matches for the CV that was just saved. Its own
    # position/headline must therefore override broad or stale account-level
    # preferences. Preferences become the fallback only when the CV carries no
    # usable position signal.
    if cv.position_id:
        category_ids = {cv.position_id}
        position_labels = [cv.position.name]
    elif headline or title_position:
        category_ids = set()
        position_labels = [headline or title_position]
    else:
        category_ids = {item.job_category_id for item in desired_categories}
        position_labels = [item.job_category.name for item in desired_categories]
        if preference.desired_position_other:
            position_labels.append(preference.desired_position_other)
    position_terms = {_normalized(value) for value in [headline, *position_labels] if value}
    if not position_terms and title_position:
        position_terms.add(_normalized(title_position))
    province_ids = {item.location_id for item in preference.preferred_provinces.all()}
    focus_keyword = headline or (cv.position.name if cv.position_id else '') or title_position or preference.desired_position_other or cv.title
    return {
        'cv': cv,
        'preference': preference,
        'skills': skills,
        'category_ids': category_ids,
        'position_labels': position_labels,
        'position_terms': position_terms,
        'province_ids': province_ids,
        'focus_keyword': focus_keyword,
    }


def _score_job(job, context):
    details = []

    def add_detail(code, label, points):
        details.append({'code': code, 'label': label, 'points': points})

    title = _normalized(job.title)
    matching_primary_categories = [
        item for item in job.category_assignments.all()
        if item.role == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
        and item.category_id in context['category_ids']
    ]
    if matching_primary_categories and _has_semantic_token_overlap(
        title, [item.category.name for item in matching_primary_categories],
    ):
        add_detail('category', 'Đúng vị trí chuyên môn', 38)

    if _contains_term(title, context['position_terms']):
        add_detail('position', 'Khớp vị trí trên CV', 24)

    job_skills = {_normalized(item.skill.name) for item in job.job_skills.all()}
    matched_skills = sorted(context['skills'] & job_skills)
    if matched_skills:
        add_detail('skills', f'Khớp {len(matched_skills)} kỹ năng', min(24, len(matched_skills) * 6))

    provinces = {
        item.location.parent_id or item.location_id
        for item in job.job_locations.all()
    }
    if provinces & context['province_ids']:
        add_detail('location', 'Đúng địa điểm mong muốn', 10)

    candidate_experience = EXPERIENCE_RANK.get(context['preference'].experience_level, 0)
    required_experience = EXPERIENCE_RANK.get(job.experience_years, 0)
    if job.experience_years and candidate_experience >= required_experience:
        add_detail('experience', 'Kinh nghiệm phù hợp', 6)

    desired_salary = context['preference'].desired_salary_vnd
    if job.salary_type != Job.SalaryType.NEGOTIABLE and desired_salary:
        desired = Decimal(desired_salary)
        lower = job.salary_min or job.salary_max or Decimal('0')
        upper = job.salary_max or job.salary_min or Decimal('0')
        if lower <= desired * Decimal('1.25') and upper >= desired * Decimal('0.8'):
            add_detail('salary', 'Mức lương phù hợp', 8)

    # Paid tier is intentionally excluded from compatibility. It is only a
    # deterministic tie-breaker below and can never make an unrelated job fit.
    score = min(sum(item['points'] for item in details), 100)
    return score, details


def recommend_jobs_for_cv(user, public_id, *, limit=6):
    context = _cv_context(user, public_id)
    candidates = list(active_jobs_queryset().order_by('-published_at', '-created_at')[:200])
    ranked = []
    for job in candidates:
        score, details = _score_job(job, context)
        if score < MIN_RECOMMENDATION_SCORE:
            continue
        ranked.append({
            'job': job,
            'match_score': score,
            'match_details': details,
            'match_reasons': [item['label'] for item in details],
        })
    tier_rank = {Job.Tier.TOP: 2, Job.Tier.FEATURED: 1}
    ranked.sort(key=lambda item: (
        item['match_score'],
        tier_rank.get(item['job'].tier, 0),
        item['job'].published_at or item['job'].created_at,
    ), reverse=True)
    selected = ranked[:limit]

    related = []
    seen = set()
    for label in context['position_labels']:
        key = _normalized(label)
        if key and key not in seen:
            seen.add(key)
            related.append({'label': label, 'search': label})
    return {
        'focus_keyword': context['focus_keyword'],
        'strategy': 'profile-rule-v2',
        'minimum_match_score': MIN_RECOMMENDATION_SCORE,
        'results': selected,
        'related_positions': related[:9],
    }
