"""Worker chạy một yêu cầu đã xếp hàng: nhận lease, gọi model, lưu kết quả hoặc mã lỗi."""

import logging
import re
from datetime import timedelta

from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.ai_core.services import AiGenerationError, generate_structured

from ...models import JobAiGeneration
from .errors import JobAiGenerationUnavailable
from .prompt import (
    PROMPT_VERSION,
    RESPONSE_SCHEMA,
    SCHEMA_VERSION,
    USE_CASE,
    approved_company_context,
    generation_prompt,
    system_instruction,
)
from .submission import job_ai_policy
from .suggestion import normalize_ai_suggestion, validate_generated_draft

logger = logging.getLogger(__name__)

SAFE_CODE_RE = re.compile(r'[^a-z0-9_]+')
# Provider, policy and schema failures are normal outcomes stored as an error code;
# anything else is a bug worth a stack trace even though the row still fails.
EXPECTED_FAILURES = (AiGenerationError, JobAiGenerationUnavailable, ValidationError, ValueError)


def _call_generate_structured(generation, prompt):
    return generate_structured(
        use_case=USE_CASE,
        prompt=prompt,
        response_schema=RESPONSE_SCHEMA,
        prompt_version=PROMPT_VERSION,
        schema_version=SCHEMA_VERSION,
        system_instruction=system_instruction(generation.locale),
        result_validator=validate_generated_draft,
        model=generation.model,
        correlation_key=generation.public_id,
    )


@transaction.atomic
def _claim_generation(generation_id):
    generation = (
        JobAiGeneration.objects.select_for_update()
        .select_related('company', 'owner')
        .filter(pk=generation_id)
        .first()
    )
    if generation is None or generation.status != JobAiGeneration.Status.QUEUED:
        return None
    now = timezone.now()
    generation.status = JobAiGeneration.Status.PROCESSING
    generation.phase = JobAiGeneration.Phase.PREPARING_CONTEXT
    generation.started_at = generation.started_at or now
    generation.lease_expires_at = now + timedelta(
        seconds=max(settings.AI_JOB_GENERATION_LEASE_SECONDS, 1)
    )
    generation.error_code = ''
    generation.save(
        update_fields=[
            'status',
            'phase',
            'started_at',
            'lease_expires_at',
            'error_code',
            'updated_at',
        ]
    )
    return generation


@transaction.atomic
def _set_generation_phase(generation_id, phase):
    generation = JobAiGeneration.objects.select_for_update().get(pk=generation_id)
    if generation.status != JobAiGeneration.Status.PROCESSING:
        return False
    generation.phase = phase
    generation.save(update_fields=['phase', 'updated_at'])
    return True


def _error_code(error):
    code = getattr(error, 'code', '') or getattr(error, 'machine_code', '')
    if not code and isinstance(error, ValueError) and error.args == ('invalid_ai_schema',):
        code = 'invalid_ai_schema'
    code = code or 'job_ai_generation_failed'
    normalized = SAFE_CODE_RE.sub('_', str(code).lower()).strip('_')
    return normalized[:80] or 'job_ai_generation_failed'


@transaction.atomic
def fail_job_ai_generation(generation_id, *, code, provider_attempts=0, invocation_id=None):
    generation = JobAiGeneration.objects.select_for_update().filter(pk=generation_id).first()
    if generation is None or generation.status == JobAiGeneration.Status.CANCELLED:
        return False
    if generation.status == JobAiGeneration.Status.COMPLETED:
        return False
    generation.status = JobAiGeneration.Status.FAILED
    generation.phase = JobAiGeneration.Phase.FAILED
    generation.error_code = SAFE_CODE_RE.sub('_', str(code).lower()).strip('_')[:80]
    generation.provider_attempts = min(max(provider_attempts, 0), 65535)
    generation.invocation_id = invocation_id
    generation.lease_expires_at = None
    generation.finished_at = timezone.now()
    generation.save(
        update_fields=[
            'status',
            'phase',
            'error_code',
            'provider_attempts',
            'invocation_id',
            'lease_expires_at',
            'finished_at',
            'updated_at',
        ]
    )
    return True


def execute_job_ai_generation(generation_id):
    """Run a claimed generation; ai_core owns the at-most-two provider attempts."""
    generation = _claim_generation(generation_id)
    if generation is None:
        return None
    result = None
    try:
        if not job_ai_policy().enabled_for(generation.company):
            raise JobAiGenerationUnavailable()
        company_context = approved_company_context(generation)
        if not _set_generation_phase(generation.pk, JobAiGeneration.Phase.GENERATING):
            return generation.public_id
        result = _call_generate_structured(
            generation,
            generation_prompt(generation, company_context),
        )
        if not _set_generation_phase(generation.pk, JobAiGeneration.Phase.VALIDATING):
            return generation.public_id
        suggestion, warnings, unresolved = normalize_ai_suggestion(
            generation,
            result.data,
            company_context=company_context,
        )
    except SoftTimeLimitExceeded:
        # The task marks the row as timed out; swallowing here would hide the time limit.
        raise
    except Exception as error:  # noqa: BLE001 - worker boundary: every failure must end the row
        if not isinstance(error, EXPECTED_FAILURES):
            logger.exception('Job AI generation %s failed unexpectedly.', generation.public_id)
        attempts = getattr(error, 'attempts', ()) or getattr(result, 'attempts', ()) or ()
        fail_job_ai_generation(
            generation.pk,
            code=_error_code(error),
            provider_attempts=len(attempts),
            invocation_id=getattr(error, 'invocation_id', None)
            or getattr(result, 'invocation_id', None),
        )
        return generation.public_id

    with transaction.atomic():
        current = JobAiGeneration.objects.select_for_update().get(pk=generation.pk)
        if current.status != JobAiGeneration.Status.PROCESSING:
            return current.public_id
        current.status = JobAiGeneration.Status.COMPLETED
        current.phase = JobAiGeneration.Phase.COMPLETED
        current.result = suggestion
        current.warnings = warnings
        current.unresolved_suggestions = unresolved
        current.provider_attempts = len(result.attempts)
        current.invocation_id = result.invocation_id
        current.model = result.model
        current.error_code = ''
        current.lease_expires_at = None
        current.finished_at = timezone.now()
        current.save(
            update_fields=[
                'status',
                'phase',
                'result',
                'warnings',
                'unresolved_suggestions',
                'provider_attempts',
                'invocation_id',
                'model',
                'error_code',
                'lease_expires_at',
                'finished_at',
                'updated_at',
            ]
        )
    return generation.public_id


@transaction.atomic
def recover_stale_job_ai_generations(
    *,
    now=None,
    queued_age_seconds=60,
    queued_timeout_seconds=85,
    batch_size=100,
):
    now = now or timezone.now()
    queued_before = now - timedelta(seconds=max(queued_age_seconds, 1))
    queued_timeout_before = now - timedelta(
        seconds=max(queued_timeout_seconds, queued_age_seconds + 1)
    )
    rows = list(
        JobAiGeneration.objects.select_for_update(skip_locked=True)
        .filter(
            models.Q(
                status=JobAiGeneration.Status.PROCESSING,
                lease_expires_at__lte=now,
            )
            | models.Q(
                status=JobAiGeneration.Status.QUEUED,
                created_at__lte=queued_before,
            )
        )
        .order_by('created_at')[:batch_size]
    )
    ids = []
    for generation in rows:
        if generation.status == JobAiGeneration.Status.PROCESSING:
            # A lost worker may already have spent the two allowed provider attempts.
            # Terminal failure is safer than silently starting a third request.
            generation.status = JobAiGeneration.Status.FAILED
            generation.phase = JobAiGeneration.Phase.FAILED
            generation.error_code = 'stale_lease_expired'
            generation.finished_at = now
            generation.lease_expires_at = None
            generation.save(
                update_fields=[
                    'status',
                    'phase',
                    'error_code',
                    'finished_at',
                    'lease_expires_at',
                    'updated_at',
                ]
            )
            continue
        if generation.created_at <= queued_timeout_before:
            generation.status = JobAiGeneration.Status.FAILED
            generation.phase = JobAiGeneration.Phase.FAILED
            generation.error_code = 'queue_timeout'
            generation.finished_at = now
            generation.lease_expires_at = None
            generation.save(
                update_fields=[
                    'status',
                    'phase',
                    'error_code',
                    'finished_at',
                    'lease_expires_at',
                    'updated_at',
                ]
            )
            continue
        generation.phase = JobAiGeneration.Phase.QUEUED
        generation.lease_expires_at = None
        generation.save(update_fields=['phase', 'lease_expires_at', 'updated_at'])
        ids.append(generation.pk)
    return ids
