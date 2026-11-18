"""Vòng đời kết quả đã sinh: hủy, đánh giá, gắn vào tin và xóa nội dung hết hạn lưu."""

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ...models import JobAiGeneration
from .sanitize import plain_text


@transaction.atomic
def cancel_job_ai_generation(*, generation, user):
    current = JobAiGeneration.objects.select_for_update().get(pk=generation.pk, owner=user)
    if current.status in {JobAiGeneration.Status.QUEUED, JobAiGeneration.Status.PROCESSING}:
        current.status = JobAiGeneration.Status.CANCELLED
        current.phase = JobAiGeneration.Phase.CANCELLED
        current.lease_expires_at = None
        current.finished_at = timezone.now()
        current.save(
            update_fields=[
                'status',
                'phase',
                'lease_expires_at',
                'finished_at',
                'updated_at',
            ]
        )
    return current


@transaction.atomic
def record_job_ai_feedback(*, generation, user, value, reason=''):
    current = JobAiGeneration.objects.select_for_update().get(pk=generation.pk, owner=user)
    if current.status != JobAiGeneration.Status.COMPLETED:
        raise ValidationError({'feedback': 'Chỉ có thể đánh giá kết quả đã hoàn tất.'})
    current.feedback = value
    current.feedback_reason = reason
    current.feedback_at = timezone.now()
    current.save(update_fields=['feedback', 'feedback_reason', 'feedback_at', 'updated_at'])
    return current


def _generated_content_comparison(value):
    if not isinstance(value, dict):
        return {}
    return {
        'title': plain_text(value.get('title'), max_length=255),
        'description': plain_text(value.get('description'), max_length=10000),
        'requirements': plain_text(value.get('requirements'), max_length=10000),
        'benefits': plain_text(value.get('benefits'), max_length=10000),
        'work_types': list(value.get('work_types') or []),
        'employment_type': value.get('employment_type') or '',
        'experience_years': value.get('experience_years') or '',
        'position_level': value.get('position_level') or '',
        'education_level': value.get('education_level') or '',
        'category_assignments': [
            {'category': item.get('category'), 'role': item.get('role')}
            for item in value.get('category_assignments') or []
        ],
        'job_skills': [
            {'skill': item.get('skill'), 'importance': item.get('importance')}
            for item in value.get('job_skills') or []
        ],
        'job_benefits': [
            {'benefit': item.get('benefit')} for item in value.get('job_benefits') or []
        ],
    }


def _applied_content_snapshot(job):
    return {
        'title': plain_text(job.title, max_length=255),
        'description': plain_text(job.description, max_length=10000),
        'requirements': plain_text(job.requirements, max_length=10000),
        'benefits': plain_text(job.benefits, max_length=10000),
        'work_types': list(job.work_types or []),
        'employment_type': job.employment_type,
        'experience_years': job.experience_years,
        'position_level': job.position_level,
        'education_level': job.education_level,
        'category_assignments': list(
            job.category_assignments.order_by('sort_order', 'id').values(
                'category_id',
                'role',
            )
        ),
        'job_skills': list(job.job_skills.order_by('id').values('skill_id', 'importance')),
        'job_benefits': list(job.job_benefits.order_by('sort_order', 'id').values('benefit_id')),
    }


def _applied_content_diff(job, generated_result):
    generated = _generated_content_comparison(generated_result)
    final = _applied_content_snapshot(job)
    # Normalize Django's FK value keys to the public form keys used by the generation result.
    final['category_assignments'] = [
        {'category': item['category_id'], 'role': item['role']}
        for item in final['category_assignments']
    ]
    final['job_skills'] = [
        {'skill': item['skill_id'], 'importance': item['importance']}
        for item in final['job_skills']
    ]
    final['job_benefits'] = [{'benefit': item['benefit_id']} for item in final['job_benefits']]
    changed_fields = [
        field for field, final_value in final.items() if generated.get(field) != final_value
    ]
    return {'changed_fields': changed_fields, 'final': final}


@transaction.atomic
def apply_job_ai_generation_to_draft(*, public_id, job, user):
    generation = (
        JobAiGeneration.objects.select_for_update().filter(public_id=public_id, owner=user).first()
    )
    if generation is None:
        raise ValidationError({'ai_generation_public_id': 'Kết quả AI không tồn tại.'})
    if generation.company_id != job.company_id:
        raise ValidationError({'ai_generation_public_id': 'Kết quả AI không thuộc công ty này.'})
    if generation.status != JobAiGeneration.Status.COMPLETED or not generation.result:
        raise ValidationError({'ai_generation_public_id': 'Kết quả AI chưa hoàn tất.'})
    if generation.applied_job_id and generation.applied_job_id != job.pk:
        raise ValidationError({'ai_generation_public_id': 'Kết quả AI đã được dùng cho tin khác.'})
    generation.applied_job = job
    generation.applied_at = generation.applied_at or timezone.now()
    generation.applied_diff = _applied_content_diff(job, generation.result)
    generation.save(update_fields=['applied_job', 'applied_at', 'applied_diff', 'updated_at'])
    return generation


def purge_job_ai_generation_content(*, now=None):
    now = now or timezone.now()
    cutoff = now - timedelta(days=max(settings.AI_JOB_GENERATION_CONTENT_RETENTION_DAYS, 1))
    return JobAiGeneration.objects.filter(
        created_at__lt=cutoff,
        content_purged_at__isnull=True,
    ).update(
        sanitized_input={},
        result={},
        warnings=[],
        unresolved_suggestions={},
        applied_diff={},
        content_purged_at=now,
        updated_at=now,
    )
