"""Lọc sơ bộ, chấm điểm và trả các luồng gợi ý việc làm (trang, CV, email, chèn kết quả)."""

import hashlib
from math import ceil

from django.db.models import Exists, OuterRef, Q

from apps.cvs.models import UserCv
from common.db.search import search_q

from ..alerts import CandidateJobDigestItem, CandidateJobEmailSuppression
from ..core import Job
from ..querysets import active_jobs_queryset
from .context import (
    ai_recommendation_allowed,
    candidate_context,
    cv_context,
    cv_signals,
    preference_state,
)
from .scoring import MIN_RECOMMENDATION_SCORE, normalize_term, presentation_match_reasons, score_job

MAX_SCORING_CANDIDATES = 500
INLINE_RECOMMENDATION_RATE_PERCENT = 40
INLINE_RECOMMENDATION_POOL_SIZE = 8


def _ranking_candidates(
    context,
    *,
    user=None,
    published_after=None,
    published_before=None,
    exclude_saved=False,
    exclude_emailed=False,
    excluded_public_ids=(),
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
        queryset = queryset.exclude(
            Q(applications__candidate=user) | Q(hidden_by_candidates__candidate=user)
        )
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
    if excluded_public_ids:
        queryset = queryset.exclude(public_id__in=excluded_public_ids)
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
        score, details = score_job(job, context)
        if score < MIN_RECOMMENDATION_SCORE:
            continue
        ranked.append(
            {
                'job': job,
                'match_score': score,
                'match_details': details,
                'match_reasons': presentation_match_reasons(details),
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
        key = normalize_term(label)
        if key and key not in seen:
            seen.add(key)
            related.append({'label': label, 'search': label})
    return related[:9]


def recommend_jobs_for_cv(user, public_id, *, limit=6):
    context = cv_context(user, public_id)
    selected = _rank_jobs(context)[:limit]
    return {
        'focus_keyword': context['focus_keyword'],
        'strategy': 'profile-rule-v2',
        'minimum_match_score': MIN_RECOMMENDATION_SCORE,
        'results': selected,
        'related_positions': _related_positions(context['position_labels']),
    }


def rule_scores_for_cv(cv_id, job_ids):
    """{id tin: điểm `profile-rule-v2`} của một CV với các tin đang công khai cho trước.

    Mốc so sánh cho thực nghiệm đối sánh (`matching_evaluate`). Chỉ dùng tín hiệu
    của CV, không dùng nhu cầu ứng viên khai, và không qua bước kiểm tra đồng ý vì
    điểm không hiển thị cho ai.
    """
    cv = (
        UserCv.objects.select_related('position', 'latest_version')
        .prefetch_related('cv_skills__skill')
        .get(pk=cv_id)
    )
    context = cv_signals(cv, None)
    return {
        job.pk: score_job(job, context)[0] for job in active_jobs_queryset().filter(pk__in=job_ids)
    }


def recommend_jobs_for_candidate(user, *, page=1, page_size=10):
    """Rank candidate-wide opportunities from explicit job preferences only."""
    profile, preference = preference_state(user)
    preferences_ready = bool(profile and profile.job_preferences_configured and preference)
    base = {
        'strategy': 'candidate-preference-rule-v2',
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
    if not ai_recommendation_allowed(profile):
        return {
            **base,
            'status': 'consent_required',
            'needs_setup': False,
            'consent_required': True,
            'pagination': empty_pagination,
        }

    context = candidate_context(preference)
    ranked = _rank_jobs(context, user=user)
    total = len(ranked)
    total_pages = ceil(total / page_size) if total else 0
    start = (page - 1) * page_size
    selected = ranked[start : start + page_size]
    return {
        **base,
        'status': 'ready',
        'needs_setup': False,
        'consent_required': False,
        'sources': base['sources'],
        'source_cv': None,
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
    """Rank newly public jobs for email from explicit preferences only."""
    profile, preference = preference_state(user)
    if not profile or not profile.job_preferences_configured or not preference:
        return {'status': 'preferences_required', 'results': []}
    if not ai_recommendation_allowed(profile):
        return {'status': 'consent_required', 'results': []}

    context = candidate_context(preference)
    ranked = _rank_jobs(
        context,
        user=user,
        published_after=published_after,
        published_before=published_before,
        exclude_saved=True,
        exclude_emailed=True,
    )
    return {'status': 'ready', 'results': ranked[:limit]}


def _inline_random_bytes(user, ranking_seed, page):
    value = f'inline-recommendation-v1:{user.pk}:{ranking_seed}:{page}'.encode()
    return hashlib.sha256(value).digest()


def recommend_inline_jobs_for_candidate(
    user,
    *,
    page,
    ranking_seed,
    excluded_public_ids=(),
):
    """Return a deterministic occasional recommendation lane for a search-result page."""
    profile, preference = preference_state(user)
    if not profile or not profile.job_preferences_configured or not preference:
        return {
            'status': 'preferences_required',
            'after_result_index': None,
            'results': [],
        }
    if not ai_recommendation_allowed(profile):
        return {
            'status': 'consent_required',
            'after_result_index': None,
            'results': [],
        }

    random_bytes = _inline_random_bytes(user, ranking_seed, page)
    display_bucket = int.from_bytes(random_bytes[:4], 'big') % 100
    if display_bucket >= INLINE_RECOMMENDATION_RATE_PERCENT:
        return {
            'status': 'not_shown',
            'after_result_index': None,
            'results': [],
        }

    context = candidate_context(preference)
    ranked = _rank_jobs(
        context,
        user=user,
        excluded_public_ids=excluded_public_ids,
    )
    pool = ranked[:INLINE_RECOMMENDATION_POOL_SIZE]
    if not pool:
        return {'status': 'ready', 'after_result_index': None, 'results': []}

    requested_count = 1 + (random_bytes[4] % 2)
    result_count = min(requested_count, len(pool))
    start = int.from_bytes(random_bytes[5:9], 'big') % len(pool)
    selected = [pool[(start + offset) % len(pool)] for offset in range(result_count)]
    return {
        'status': 'ready',
        'after_result_index': 3 + (random_bytes[9] % 5),
        'results': selected,
    }
