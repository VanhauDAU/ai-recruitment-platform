"""Dựng ngữ cảnh xếp hạng từ CV hoặc nhu cầu việc làm đã khai báo của ứng viên.

Dữ liệu CV chỉ được đọc sau khi kiểm tra đồng ý gợi ý việc làm bằng AI.
"""

import re

from django.utils.translation import gettext as _

from apps.candidates.models import CandidateConsent, CandidateJobPreference, CandidateProfile
from apps.cvs.models import UserCv

from ..core import Job
from .scoring import normalize_term


class RecommendationConsentRequired(Exception):
    """Raised before CV data is read when recommendation consent is absent."""


def _position_from_cv_title(title):
    """Use a descriptive CV title only when structured position data is absent."""
    value = re.sub(r'^cv(?:\s+của)?\s+', '', str(title or '').strip(), flags=re.IGNORECASE)
    return value if value and value != str(title or '').strip() else ''


def preference_state(user):
    """Read preference + consent without mutating data from a selector."""
    preference = (
        CandidateJobPreference.objects.select_related('candidate_profile')
        .prefetch_related(
            'desired_specializations__job_category',
            'desired_position_others',
            'preferred_skills__skill',
            'preferred_provinces__location',
            'candidate_profile__consents',
        )
        .filter(candidate_profile__user=user)
        .first()
    )
    if preference:
        return preference.candidate_profile, preference
    profile = CandidateProfile.objects.prefetch_related('consents').filter(user=user).first()
    return profile, None


def ai_recommendation_allowed(profile):
    if not profile:
        return False
    return any(
        consent.consent_type == CandidateConsent.ConsentType.AI_RECOMMENDATION
        and consent.decision == CandidateConsent.Decision.GRANTED
        for consent in profile.consents.all()
    )


def _candidate_cvs(user):
    return (
        UserCv.objects.filter(user=user, is_deleted=False)
        .exclude(lifecycle_status=UserCv.LifecycleStatus.ARCHIVED)
        .exclude(processing_status=UserCv.ProcessingStatus.FAILED)
        .select_related('position', 'latest_version')
        .prefetch_related('cv_skills__skill')
        .order_by('-is_default', '-updated_at', '-pk')
    )


def _cv_content(cv):
    version = cv.latest_version
    content = version.content_json if version else {}
    personal = content.get('personal_info', {}) if isinstance(content, dict) else {}
    headline = str(personal.get('headline') or personal.get('job_title') or '').strip()
    return content, headline


def _cv_skills(cv, content):
    skills = {normalize_term(item.skill.name) for item in cv.cv_skills.all() if item.skill_id}
    skill_ids = {item.skill_id for item in cv.cv_skills.all() if item.skill_id}
    for section in content.get('sections', []) if isinstance(content, dict) else []:
        if not isinstance(section, dict) or section.get('section_key') != 'skills':
            continue
        for item in section.get('items', []):
            if isinstance(item, dict) and item.get('name'):
                skills.add(normalize_term(item['name']))
    return skills, skill_ids


def _preference_values(preference):
    return {
        'experience_level': preference.experience_level if preference else '',
        'desired_salary': preference.desired_salary_vnd if preference else None,
        'willing_to_relocate': preference.willing_to_relocate if preference else False,
        'province_ids': (
            {item.location_id for item in preference.preferred_provinces.all()}
            if preference
            else set()
        ),
    }


def cv_context(user, public_id):
    if not _candidate_cvs(user).filter(public_id=public_id).exists():
        raise UserCv.DoesNotExist
    profile, preference = preference_state(user)
    if not ai_recommendation_allowed(profile):
        raise RecommendationConsentRequired

    cv = _candidate_cvs(user).get(public_id=public_id)
    content, headline = _cv_content(cv)
    skills, skill_ids = _cv_skills(cv, content)
    desired_categories = list(preference.desired_specializations.all()) if preference else []
    custom_positions = (
        [item.name for item in preference.desired_position_others.all()] if preference else []
    )
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
        position_labels.extend(custom_positions)
    position_terms = {normalize_term(value) for value in [headline, *position_labels] if value}
    if not position_terms and title_position:
        position_terms.add(normalize_term(title_position))
    focus_keyword = (
        headline
        or (cv.position.name if cv.position_id else '')
        or title_position
        or next(iter(custom_positions), '')
        or cv.title
    )
    return {
        'cv': cv,
        'skills': skills,
        'skill_ids': skill_ids,
        'category_ids': category_ids,
        'position_labels': position_labels,
        'position_terms': position_terms,
        'position_query_labels': [headline, *position_labels],
        'position_reason': _('Khớp vị trí trên CV'),
        'focus_keyword': focus_keyword,
        **_preference_values(preference),
        # Số năm kinh nghiệm tính từ chính CV (cùng enum với JD) được ưu tiên như
        # vị trí; CV chưa có mục kinh nghiệm thì dùng khai báo của ứng viên.
        **(
            {'experience_level': cv.experience_years}
            if cv.experience_years and cv.experience_years != Job.ExperienceYears.NONE
            else {}
        ),
    }


def candidate_context(preference):
    """Build ranking context only from the candidate's explicit job preferences."""
    desired_categories = list(preference.desired_specializations.all())
    position_labels = [item.job_category.name for item in desired_categories]
    position_labels.extend(item.name for item in preference.desired_position_others.all())

    preferred_skills = list(preference.preferred_skills.all())
    skills = {normalize_term(item.skill.name) for item in preferred_skills}
    skill_ids = {item.skill_id for item in preferred_skills}
    focus_keyword = next((label for label in position_labels if label), '')
    return {
        'cv': None,
        'skills': skills,
        'skill_ids': skill_ids,
        'category_ids': {item.job_category_id for item in desired_categories},
        'position_labels': position_labels,
        'position_terms': {normalize_term(label) for label in position_labels if label},
        'position_query_labels': position_labels,
        'position_reason': _('Khớp vị trí bạn quan tâm'),
        'focus_keyword': focus_keyword,
        **_preference_values(preference),
    }
