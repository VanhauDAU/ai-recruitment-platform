"""Deterministic job similarity from a candidate's recent saved jobs."""

import re

from django.db.models import Prefetch, Q

from common.db.search import fold_accents, search_q

from ..models import JobCategoryAssignment, JobLocation, JobSkill, SavedJob
from .listing import active_jobs_queryset

MAX_SAVED_SOURCES = 20
MAX_SCORING_CANDIDATES = 500
MIN_SIMILARITY_SCORE = 20

EXPERIENCE_RANK = {
    'none': 0,
    'under_1': 1,
    '1': 2,
    '2': 3,
    '3': 4,
    '4': 5,
    '5': 6,
    'over_5': 7,
}

TITLE_STOP_WORDS = {
    'admin',
    'administrator',
    'and',
    'associate',
    'ban',
    'chief',
    'chuyen',
    'cong',
    'consultant',
    'coordinator',
    'developer',
    'doc',
    'engineer',
    'executive',
    'fresher',
    'full',
    'giam',
    'head',
    'intern',
    'internship',
    'ky',
    'lap',
    'lead',
    'leader',
    'junior',
    'manager',
    'mid',
    'middle',
    'nhan',
    'nhom',
    'officer',
    'part',
    'phong',
    'principal',
    'quan',
    'senior',
    'specialist',
    'staff',
    'su',
    'tap',
    'team',
    'the',
    'thuc',
    'time',
    'trinh',
    'truong',
    'vien',
}
SHORT_DOMAIN_TOKENS = {'ai', 'hr', 'it', 'qa', 'ui', 'ux'}
TITLE_ANCHOR_TOKENS = SHORT_DOMAIN_TOKENS | {
    'aws',
    'b2b',
    'b2c',
    'crm',
    'erp',
    'ios',
    'java',
    'php',
    'sap',
    'seo',
    'sql',
}


def _semantic_tokens(value):
    return {
        token
        for token in re.findall(r'[a-z0-9]+', fold_accents(str(value or '')).lower())
        if token not in TITLE_STOP_WORDS and (len(token) >= 3 or token in SHORT_DOMAIN_TOKENS)
    }


def _work_types(job):
    values = set(job.work_types or [])
    if job.work_type:
        values.add(job.work_type)
    return values


def _root_category_id(category):
    current = category
    while current.parent_id:
        current = current.parent
    return current.id


def _job_context(job):
    assignments = list(job.category_assignments.all())
    primary_assignments = [
        assignment
        for assignment in assignments
        if assignment.role == JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION
    ]
    return {
        'job': job,
        'primary_category_ids': {assignment.category_id for assignment in primary_assignments},
        'primary_category_root_ids': {
            _root_category_id(assignment.category) for assignment in primary_assignments
        },
        'category_ids': {assignment.category_id for assignment in assignments},
        'title_tokens': _semantic_tokens(job.title),
        'skill_ids': {item.skill_id for item in job.job_skills.all()},
        'province_ids': {
            item.location.parent_id or item.location_id for item in job.job_locations.all()
        },
        'experience_years': job.experience_years,
        'work_types': _work_types(job),
        'employment_type': job.employment_type,
    }


def _recent_saved_job_contexts(user):
    saved_jobs = list(
        SavedJob.objects.filter(candidate=user)
        .select_related('job')
        .prefetch_related(
            Prefetch(
                'job__category_assignments',
                queryset=JobCategoryAssignment.objects.select_related('category__parent__parent'),
            ),
            Prefetch(
                'job__job_locations',
                queryset=JobLocation.objects.select_related('location__parent'),
            ),
            'job__job_skills',
        )
        .order_by('-created_at', '-pk')[:MAX_SAVED_SOURCES]
    )
    return [_job_context(saved_job.job) for saved_job in saved_jobs]


def _source_signal_filter(source_contexts):
    primary_category_ids = set()
    primary_category_root_ids = set()
    title_tokens = set()

    for source in source_contexts:
        primary_category_ids.update(source['primary_category_ids'])
        primary_category_root_ids.update(source['primary_category_root_ids'])
        # Keep every source represented while bounding title OR clauses.
        title_tokens.update(
            sorted(source['title_tokens'], key=lambda token: (-len(token), token))[:5]
        )

    signals = Q()
    if primary_category_ids:
        signals |= Q(
            category_assignments__category_id__in=primary_category_ids,
            category_assignments__role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
    if primary_category_root_ids:
        signals |= Q(
            Q(category_assignments__category_id__in=primary_category_root_ids)
            | Q(category_assignments__category__parent_id__in=primary_category_root_ids)
            | Q(category_assignments__category__parent__parent_id__in=(primary_category_root_ids)),
            category_assignments__role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
    for token in sorted(title_tokens):
        signals |= search_q('title', token)
    return signals


def _available_jobs(user):
    queryset = (
        active_jobs_queryset()
        .prefetch_related(None)
        .prefetch_related(
            Prefetch(
                'category_assignments',
                queryset=JobCategoryAssignment.objects.select_related('category__parent__parent'),
            ),
            Prefetch(
                'job_locations',
                queryset=JobLocation.objects.select_related('location__parent'),
            ),
            Prefetch(
                'job_skills',
                queryset=JobSkill.objects.select_related('skill'),
            ),
        )
    )
    return queryset.exclude(
        saved_by__candidate=user,
    ).exclude(
        applications__candidate=user,
    )


def _similarity_candidates(user, source_contexts):
    signals = _source_signal_filter(source_contexts)
    if not signals:
        return []
    return list(
        _available_jobs(user)
        .filter(signals)
        .distinct()
        .order_by('-published_at', '-created_at', '-pk')[:MAX_SCORING_CANDIDATES]
    )


def _recent_active_fallback(user, limit):
    return list(
        _available_jobs(user).distinct().order_by('-published_at', '-created_at', '-pk')[:limit]
    )


def _add_detail(details, code, label, points):
    details.append({'code': code, 'label': label, 'points': points})


def _score_pair(candidate, source):
    details = []
    has_primary_match = bool(candidate['primary_category_ids'] & source['primary_category_ids'])
    has_primary_group_match = bool(
        candidate['primary_category_root_ids'] & source['primary_category_root_ids']
    )
    supporting_category_match = bool(candidate['category_ids'] & source['category_ids'])
    shared_title_tokens = candidate['title_tokens'] & source['title_tokens']
    conflicting_primary_categories = bool(
        candidate['primary_category_root_ids']
        and source['primary_category_root_ids']
        and not has_primary_group_match
    )
    has_title_anchor = (
        not conflicting_primary_categories
        and bool(shared_title_tokens)
        and (
            len(shared_title_tokens) >= 2
            or any(len(token) >= 5 or token in TITLE_ANCHOR_TOKENS for token in shared_title_tokens)
        )
    )
    shared_skills = candidate['skill_ids'] & source['skill_ids']

    if has_primary_match:
        _add_detail(details, 'primary_category', 'Cùng vị trí chuyên môn', 36)

    if has_title_anchor:
        _add_detail(details, 'title', 'Tiêu đề có chuyên môn tương tự', 22)

    # Skills, secondary categories and operational attributes are supporting only.
    # A result first needs an anchor in the primary taxonomy tree or a strong
    # title signal; otherwise common/noisy seed data must not manufacture a match.
    if not (has_primary_match or has_primary_group_match or has_title_anchor):
        return 0, []

    if shared_skills:
        points = min(24, len(shared_skills) * 6)
        _add_detail(details, 'skills', f'Cùng {len(shared_skills)} kỹ năng', points)

    if not has_primary_match and (has_primary_group_match or supporting_category_match):
        label = 'Cùng nhóm ngành chính' if has_primary_group_match else 'Cùng lĩnh vực chuyên môn'
        _add_detail(details, 'category', label, 12)

    if candidate['province_ids'] & source['province_ids']:
        _add_detail(details, 'province', 'Cùng tỉnh/thành làm việc', 10)

    candidate_experience = candidate['experience_years']
    source_experience = source['experience_years']
    if candidate_experience and source_experience:
        distance = abs(
            EXPERIENCE_RANK.get(candidate_experience, 0) - EXPERIENCE_RANK.get(source_experience, 0)
        )
        if distance == 0:
            _add_detail(details, 'experience', 'Yêu cầu kinh nghiệm tương đương', 6)
        elif distance == 1:
            _add_detail(details, 'experience', 'Yêu cầu kinh nghiệm gần tương đương', 3)

    if candidate['work_types'] & source['work_types']:
        _add_detail(details, 'work_type', 'Cùng hình thức làm việc', 5)

    if candidate['employment_type'] and candidate['employment_type'] == source['employment_type']:
        _add_detail(details, 'employment_type', 'Cùng loại hình công việc', 5)

    return min(sum(detail['points'] for detail in details), 100), details


def _rank_similar_jobs(jobs, source_contexts):
    ranked = []
    for job in jobs:
        candidate = _job_context(job)
        best_score = 0
        best_details = []
        for source in source_contexts:
            score, details = _score_pair(candidate, source)
            if score > best_score:
                best_score = score
                best_details = details
        if best_score < MIN_SIMILARITY_SCORE:
            continue
        ranked.append(
            {
                'job': job,
                'similarity_score': best_score,
                'similarity_reasons': [detail['label'] for detail in best_details],
                'similarity_details': best_details,
            }
        )

    ranked.sort(
        key=lambda item: (
            item['similarity_score'],
            item['job'].published_at or item['job'].created_at,
            item['job'].pk,
        ),
        reverse=True,
    )
    return ranked


def _fallback_result(job):
    return {
        'job': job,
        'similarity_score': 0,
        'similarity_reasons': [],
        'similarity_details': [],
    }


def recommend_jobs_from_saved(user, *, limit=12):
    """Return explainable saved-job similarity, or recent active jobs as fallback."""
    source_contexts = _recent_saved_job_contexts(user)
    if source_contexts:
        ranked = _rank_similar_jobs(
            _similarity_candidates(user, source_contexts),
            source_contexts,
        )
        if ranked:
            return {
                'status': 'ready',
                'strategy': 'saved-job-similarity-v1',
                'source_saved_job_count': len(source_contexts),
                'results': ranked[:limit],
            }

    fallback = [_fallback_result(job) for job in _recent_active_fallback(user, limit)]
    return {
        'status': 'ready' if fallback else 'empty',
        'strategy': 'recent-active-fallback-v1',
        'source_saved_job_count': len(source_contexts),
        'results': fallback,
    }
