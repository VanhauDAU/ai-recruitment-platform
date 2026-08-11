"""Deterministic CV-to-job ranking used immediately after a candidate saves."""

import re
from decimal import Decimal
from math import ceil

from django.db.models import Exists, OuterRef, Q

from apps.candidates.models import CandidateConsent, CandidateJobPreference, CandidateProfile
from apps.cvs.models import UserCv
from common.db.search import fold_accents, search_q

from .alerts import CandidateJobDigestItem, CandidateJobEmailSuppression
from .core import Job
from .details import JobCategoryAssignment
from .querysets import active_jobs_queryset

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
MAX_SCORING_CANDIDATES = 500


class RecommendationConsentRequired(Exception):
    """Raised before CV data is read when recommendation consent is absent."""


def _normalized(value):
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
            for token in re.findall(r'[a-z0-9]+', _normalized(value))
            if token not in stop_words and (len(token) >= 3 or token in short_domain_tokens)
        }

    title_tokens = tokens(text)
    return any(title_tokens & tokens(label) for label in labels)


def _position_from_cv_title(title):
    """Use a descriptive CV title only when structured position data is absent."""
    value = re.sub(r'^cv(?:\s+của)?\s+', '', str(title or '').strip(), flags=re.IGNORECASE)
    return value if value and value != str(title or '').strip() else ''


def _preference_state(user):
    """Read preference + consent without mutating data from a selector."""
    preference = (
        CandidateJobPreference.objects.select_related('candidate_profile')
        .prefetch_related(
            'desired_specializations__job_category',
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


def _ai_recommendation_allowed(profile):
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
        .exclude(status=UserCv.Status.FAILED)
        .exclude(processing_status=UserCv.ProcessingStatus.FAILED)
        .select_related('position', 'latest_version')
        .prefetch_related('cv_skills__skill')
        .order_by('-is_default', '-updated_at', '-pk')
    )


def _cv_content(cv):
    version = cv.latest_version
    content = version.content_json if version else (cv.cv_data or {})
    personal = content.get('personal_info', {}) if isinstance(content, dict) else {}
    headline = str(personal.get('headline') or personal.get('job_title') or '').strip()
    return content, headline


def _cv_skills(cv, content):
    skills = {_normalized(item.skill.name) for item in cv.cv_skills.all() if item.skill_id}
    skill_ids = {item.skill_id for item in cv.cv_skills.all() if item.skill_id}
    for section in content.get('sections', []) if isinstance(content, dict) else []:
        if not isinstance(section, dict) or section.get('section_key') != 'skills':
            continue
        for item in section.get('items', []):
            if isinstance(item, dict) and item.get('name'):
                skills.add(_normalized(item['name']))
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


def _cv_context(user, public_id):
    if not _candidate_cvs(user).filter(public_id=public_id).exists():
        raise UserCv.DoesNotExist
    profile, preference = _preference_state(user)
    if not _ai_recommendation_allowed(profile):
        raise RecommendationConsentRequired

    cv = _candidate_cvs(user).get(public_id=public_id)
    content, headline = _cv_content(cv)
    skills, skill_ids = _cv_skills(cv, content)
    desired_categories = list(preference.desired_specializations.all()) if preference else []
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
        if preference and preference.desired_position_other:
            position_labels.append(preference.desired_position_other)
    position_terms = {_normalized(value) for value in [headline, *position_labels] if value}
    if not position_terms and title_position:
        position_terms.add(_normalized(title_position))
    focus_keyword = (
        headline
        or (cv.position.name if cv.position_id else '')
        or title_position
        or (preference.desired_position_other if preference else '')
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
        'position_reason': 'Khớp vị trí trên CV',
        'focus_keyword': focus_keyword,
        **_preference_values(preference),
    }


def _candidate_context(preference, cv):
    desired_categories = list(preference.desired_specializations.all())
    position_labels = [item.job_category.name for item in desired_categories]
    if preference.desired_position_other:
        position_labels.append(preference.desired_position_other)

    skills, skill_ids, cv_labels = set(), set(), []
    if cv:
        content, headline = _cv_content(cv)
        skills, skill_ids = _cv_skills(cv, content)
        title_position = _position_from_cv_title(cv.title)
        cv_labels = [
            headline,
            cv.position.name if cv.position_id else '',
            title_position,
        ]

    all_position_labels = [*position_labels, *cv_labels]
    focus_keyword = next((label for label in position_labels if label), '')
    if not focus_keyword:
        focus_keyword = next((label for label in cv_labels if label), '')
    return {
        'cv': cv,
        'skills': skills,
        'skill_ids': skill_ids,
        'category_ids': {item.job_category_id for item in desired_categories}
        or ({cv.position_id} if cv and cv.position_id else set()),
        'position_labels': position_labels,
        'position_terms': {_normalized(label) for label in all_position_labels if label},
        'position_query_labels': all_position_labels,
        'position_reason': 'Khớp vị trí bạn quan tâm',
        'focus_keyword': focus_keyword,
        **_preference_values(preference),
    }


def _score_job(job, context):
    details = []

    def add_detail(code, label, points):
        details.append({'code': code, 'label': label, 'points': points})

    title = _normalized(job.title)
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

    job_skills = {_normalized(item.skill.name) for item in job.job_skills.all()}
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


def _ranking_candidates(
    context,
    *,
    user=None,
    published_after=None,
    published_before=None,
    exclude_saved=False,
    exclude_emailed=False,
):
    """Prefilter by strong signals, then score a bounded, relation-prefetched pool."""
    signal_filter = Q()
    if context['category_ids']:
        signal_filter |= Q(category_assignments__category_id__in=context['category_ids'])
    if context['skill_ids']:
        signal_filter |= Q(job_skills__skill_id__in=context['skill_ids'])
    for skill_name in sorted(context['skills'])[:20]:
        signal_filter |= search_q('job_skills__skill__name', skill_name)
    for label in context['position_query_labels']:
        label = str(label or '').strip()
        if label:
            signal_filter |= search_q('title', label)
    if not signal_filter:
        return []

    queryset = active_jobs_queryset().filter(signal_filter)
    if user is not None:
        queryset = queryset.exclude(applications__candidate=user)
        if exclude_saved:
            queryset = queryset.exclude(saved_by__candidate=user)
        if exclude_emailed:
            emailed_job = CandidateJobEmailSuppression.objects.filter(
                candidate=user,
                job_id=OuterRef('pk'),
            )
            in_flight = CandidateJobDigestItem.objects.filter(
                candidate=user,
                job_id=OuterRef('pk'),
                digest__status__in=('pending', 'sending'),
            )
            queryset = queryset.annotate(
                already_emailed=Exists(emailed_job),
                already_claimed=Exists(in_flight),
            ).filter(already_emailed=False, already_claimed=False)
    if published_after is not None:
        queryset = queryset.filter(published_at__gt=published_after)
    if published_before is not None:
        queryset = queryset.filter(published_at__lte=published_before)
    return list(
        queryset.distinct().order_by('-published_at', '-created_at', '-pk')[:MAX_SCORING_CANDIDATES]
    )


def _rank_jobs(context, *, user=None, **candidate_filters):
    ranked = []
    for job in _ranking_candidates(context, user=user, **candidate_filters):
        score, details = _score_job(job, context)
        if score < MIN_RECOMMENDATION_SCORE:
            continue
        ranked.append(
            {
                'job': job,
                'match_score': score,
                'match_details': details,
                'match_reasons': [item['label'] for item in details],
            }
        )
    tier_rank = {Job.Tier.TOP: 2, Job.Tier.FEATURED: 1}
    ranked.sort(
        key=lambda item: (
            item['match_score'],
            tier_rank.get(item['job'].tier, 0),
            item['job'].published_at or item['job'].created_at,
            item['job'].pk,
        ),
        reverse=True,
    )
    return ranked


def _related_positions(labels):
    related = []
    seen = set()
    for label in labels:
        key = _normalized(label)
        if key and key not in seen:
            seen.add(key)
            related.append({'label': label, 'search': label})
    return related[:9]


def recommend_jobs_for_cv(user, public_id, *, limit=6):
    context = _cv_context(user, public_id)
    selected = _rank_jobs(context)[:limit]
    return {
        'focus_keyword': context['focus_keyword'],
        'strategy': 'profile-rule-v2',
        'minimum_match_score': MIN_RECOMMENDATION_SCORE,
        'results': selected,
        'related_positions': _related_positions(context['position_labels']),
    }


def recommend_jobs_for_candidate(user, *, page=1, page_size=10):
    """Rank candidate-wide opportunities from explicit preferences and default CV."""
    profile, preference = _preference_state(user)
    preferences_ready = bool(profile and profile.job_preferences_configured and preference)
    base = {
        'strategy': 'candidate-profile-rule-v1',
        'minimum_match_score': MIN_RECOMMENDATION_SCORE,
        'preference_configured': preferences_ready,
        'sources': {
            'job_preferences': preferences_ready,
            'cv': False,
            'search_activity': False,
        },
        'source_cv': None,
        'focus_keyword': '',
        'related_positions': [],
        'results': [],
    }
    empty_pagination = {
        'page': page,
        'page_size': page_size,
        'total': 0,
        'total_pages': 0,
        'next_page': None,
        'previous_page': page - 1 if page > 1 else None,
    }
    if not preferences_ready:
        return {
            **base,
            'status': 'preferences_required',
            'needs_setup': True,
            'consent_required': False,
            'pagination': empty_pagination,
        }
    if not _ai_recommendation_allowed(profile):
        return {
            **base,
            'status': 'consent_required',
            'needs_setup': False,
            'consent_required': True,
            'pagination': empty_pagination,
        }

    cv = _candidate_cvs(user).first()
    context = _candidate_context(preference, cv)
    ranked = _rank_jobs(context, user=user)
    total = len(ranked)
    total_pages = ceil(total / page_size) if total else 0
    start = (page - 1) * page_size
    selected = ranked[start : start + page_size]
    source_cv = (
        {
            'public_id': cv.public_id,
            'title': cv.title,
            'is_default': cv.is_default,
        }
        if cv
        else None
    )
    return {
        **base,
        'status': 'ready',
        'needs_setup': False,
        'consent_required': False,
        'sources': {
            **base['sources'],
            'cv': bool(cv),
        },
        'source_cv': source_cv,
        'focus_keyword': context['focus_keyword'],
        'related_positions': _related_positions(context['position_labels']),
        'results': selected,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': total_pages,
            'next_page': page + 1 if page < total_pages else None,
            'previous_page': page - 1 if page > 1 else None,
        },
    }


def recommend_new_jobs_for_candidate_email(
    user,
    *,
    published_after,
    published_before,
    limit=50,
):
    """Rank newly public jobs for email, checking consent before reading any CV."""
    profile, preference = _preference_state(user)
    if not profile or not profile.job_preferences_configured or not preference:
        return {'status': 'preferences_required', 'results': []}
    if not _ai_recommendation_allowed(profile):
        return {'status': 'consent_required', 'results': []}

    cv = _candidate_cvs(user).first()
    context = _candidate_context(preference, cv)
    ranked = _rank_jobs(
        context,
        user=user,
        published_after=published_after,
        published_before=published_before,
        exclude_saved=True,
        exclude_emailed=True,
    )
    return {'status': 'ready', 'results': ranked[:limit]}
