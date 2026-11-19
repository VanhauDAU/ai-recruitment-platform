"""Chuẩn hóa JSON model trả về thành gợi ý bản nháp an toàn cho form đăng tin.

Mọi taxonomy phải khớp catalog đang hoạt động; quyền lợi chỉ giữ khi có bằng
chứng trong dữ liệu nguồn để AI không hứa hộ công ty.
"""

import re
import unicodedata

from django.utils.html import escape

from apps.ai_core.services import AiGenerationError
from apps.skills.models import Skill

from ...models import Benefit, Job, JobAiGeneration, JobCategory
from .sanitize import plain_text


def _normalize_lookup(value):
    value = unicodedata.normalize('NFKD', str(value or ''))
    value = ''.join(character for character in value if not unicodedata.combining(character))
    return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()


def _category_lookup():
    categories = list(
        JobCategory.objects.filter(status=JobCategory.Status.ACTIVE).prefetch_related(
            'localizations'
        )
    )
    lookup = {}
    for category in categories:
        names = [category.name]
        for localization in category.localizations.all():
            if not localization.is_active:
                continue
            names.append(localization.display_name)
            names.extend(re.split(r'[,;\n]', localization.search_aliases))
        for name in names:
            key = _normalize_lookup(name)
            if key:
                lookup.setdefault(key, category)
    return lookup


def _skill_lookup():
    lookup = {}
    for skill in Skill.objects.filter(is_active=True):
        for name in [skill.name, *skill.aliases]:
            key = _normalize_lookup(name)
            if key:
                lookup.setdefault(key, skill)
    return lookup


def _benefit_lookup():
    return {
        _normalize_lookup(benefit.name): benefit
        for benefit in Benefit.objects.filter(is_active=True)
    }


def _string_list(payload, key, *, limit=20, item_limit=1000):
    value = payload.get(key, [])
    if not isinstance(value, list):
        raise ValueError('invalid_ai_schema')
    return [
        plain_text(item, max_length=item_limit)
        for item in value[:limit]
        if isinstance(item, str) and item.strip()
    ]


def _render_bullets(items):
    if not items:
        return ''
    return '<ul>' + ''.join(f'<li>{escape(item)}</li>' for item in items) + '</ul>'


def _enum_value(payload, field, choices, warnings):
    value = payload.get(field, '')
    allowed = {choice for choice, _ in choices}
    if value in allowed:
        return value
    if value:
        warnings.append(f'invalid_{field}_removed')
    return ''


def _benefit_evidence(generation, company_context):
    values = [company_context.get('employee_benefits', '')]
    if generation.mode == JobAiGeneration.Mode.JD_TEXT:
        values.append(generation.sanitized_input.get('source_text', ''))
    return _normalize_lookup(' '.join(value for value in values if value))


def _benefit_statement_is_grounded(statement, normalized_evidence):
    normalized = _normalize_lookup(statement)
    if not normalized or not normalized_evidence:
        return False
    if normalized in normalized_evidence:
        return True
    tokens = {
        token
        for token in normalized.split()
        if len(token) >= 3
        and token
        not in {
            'cho',
            'cua',
            'duoc',
            'voi',
            'theo',
            'nhan',
            'vien',
            'cong',
            'lam',
            'viec',
        }
    }
    if len(tokens) < 2:
        return False
    evidence_tokens = set(normalized_evidence.split())
    overlap = tokens & evidence_tokens
    return len(overlap) >= 2 and len(overlap) / len(tokens) >= 0.75


def normalize_ai_suggestion(generation, payload, *, company_context):
    if not isinstance(payload, dict):
        raise ValueError('invalid_ai_schema')
    title = plain_text(payload.get('title'), max_length=255)
    if not title:
        raise ValueError('invalid_ai_schema')
    description = _string_list(payload, 'description_bullets', limit=15)
    requirements = _string_list(payload, 'requirements_bullets', limit=15)
    if not description or not requirements:
        raise ValueError('invalid_ai_schema')
    proposed_benefits = _string_list(payload, 'benefits_bullets', limit=15)
    warnings = []
    benefit_evidence = _benefit_evidence(generation, company_context)
    benefits = [
        item for item in proposed_benefits if _benefit_statement_is_grounded(item, benefit_evidence)
    ]
    if len(benefits) != len(proposed_benefits):
        warnings.append('benefits_without_source_removed')

    work_types = [
        value
        for value in _string_list(payload, 'work_types', limit=3, item_limit=30)
        if value in {choice for choice, _ in Job.WorkType.choices}
    ]
    suggestion = {
        'title': title,
        'description': _render_bullets(description),
        'requirements': _render_bullets(requirements),
        'benefits': _render_bullets(benefits),
        'work_types': list(dict.fromkeys(work_types)),
        'employment_type': _enum_value(
            payload, 'employment_type', Job.EmploymentType.choices, warnings
        ),
        'experience_years': _enum_value(
            payload, 'experience_years', Job.ExperienceYears.choices, warnings
        ),
        'position_level': _enum_value(
            payload, 'position_level', Job.PositionLevel.choices, warnings
        ),
        'education_level': _enum_value(
            payload, 'education_level', Job.EducationLevel.choices, warnings
        ),
        'category_assignments': [],
        'job_skills': [],
        'job_benefits': [],
    }

    unresolved = {'categories': [], 'skills': [], 'benefits': []}
    category_lookup = _category_lookup()
    primary_name = plain_text(payload.get('primary_specialization'), max_length=255)
    if primary_name:
        category = category_lookup.get(_normalize_lookup(primary_name))
        if category is None:
            unresolved['categories'].append(primary_name)
        else:
            suggestion['category_assignments'].append(
                {
                    'category': category.pk,
                    'category_name': category.name,
                    'role': 'primary_specialization',
                    'sort_order': 0,
                }
            )
    for name in _string_list(payload, 'domain_knowledge', limit=10, item_limit=255):
        category = category_lookup.get(_normalize_lookup(name))
        if category is None or category.category_type != JobCategory.CategoryType.DOMAIN:
            unresolved['categories'].append(name)
            continue
        key = (category.pk, 'domain_knowledge')
        if any(
            (item['category'], item['role']) == key for item in suggestion['category_assignments']
        ):
            continue
        suggestion['category_assignments'].append(
            {
                'category': category.pk,
                'category_name': category.name,
                'role': 'domain_knowledge',
                'sort_order': len(suggestion['category_assignments']),
            }
        )

    skill_lookup = _skill_lookup()
    seen_skills = set()
    for field, importance in (
        ('required_skills', 'required'),
        ('preferred_skills', 'preferred'),
    ):
        for name in _string_list(payload, field, limit=15, item_limit=255):
            skill = skill_lookup.get(_normalize_lookup(name))
            if skill is None:
                unresolved['skills'].append(name)
                continue
            if skill.pk in seen_skills:
                continue
            seen_skills.add(skill.pk)
            suggestion['job_skills'].append(
                {
                    'skill': skill.pk,
                    'skill_name': skill.name,
                    'importance': importance,
                    'min_level': '',
                }
            )

    benefit_lookup = _benefit_lookup()
    for name in _string_list(payload, 'benefit_tags', limit=15, item_limit=255):
        normalized_name = _normalize_lookup(name)
        benefit = benefit_lookup.get(normalized_name)
        if benefit is None:
            unresolved['benefits'].append(name)
            continue
        canonical_name = _normalize_lookup(benefit.name)
        if not canonical_name or canonical_name not in benefit_evidence:
            warnings.append('ungrounded_benefit_tag_removed')
            continue
        if any(item['benefit'] == benefit.pk for item in suggestion['job_benefits']):
            continue
        suggestion['job_benefits'].append(
            {
                'benefit': benefit.pk,
                'benefit_name': benefit.name,
                'note': '',
                'sort_order': len(suggestion['job_benefits']),
            }
        )
    if any(unresolved.values()):
        warnings.append('unresolved_taxonomy_suggestions')
    return suggestion, warnings, unresolved


def validate_generated_draft(payload):
    if not isinstance(payload, dict):
        raise AiGenerationError('invalid_ai_schema', retryable=True)
    title = plain_text(payload.get('title'), max_length=255)
    description = _string_list(payload, 'description_bullets', limit=15)
    requirements = _string_list(payload, 'requirements_bullets', limit=15)
    if not title or not description or not requirements:
        raise AiGenerationError('invalid_ai_schema', retryable=True)
