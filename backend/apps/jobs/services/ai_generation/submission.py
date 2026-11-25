"""Nhận yêu cầu tạo tin: idempotency, chính sách AI, hạn mức ngày rồi xếp hàng worker."""

import hashlib
import json
import logging

from django.conf import settings
from django.db import DatabaseError, transaction

from apps.ai_core.services import provider_name_for, record_ai_quota_rejection
from apps.employers.services import ensure_recruiter_job_workspace
from apps.sitecontent.selectors import get_settings_map
from common.vietnam_time import vietnam_today

from ...domain import JOB_AI_POLICY_KEYS, resolve_job_ai_policy
from ...models import JobAiGeneration
from .errors import (
    JobAiGenerationQuotaExceeded,
    JobAiGenerationUnavailable,
    JobAiIdempotencyConflict,
)
from .prompt import PROMPT_VERSION, SCHEMA_VERSION, USE_CASE
from .sanitize import sanitize_generation_input

logger = logging.getLogger(__name__)


def _request_hash(mode, locale, sanitized_input):
    payload = json.dumps(
        {'mode': mode, 'locale': locale, 'input': sanitized_input},
        ensure_ascii=False,
        sort_keys=True,
        separators=(',', ':'),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def job_ai_policy():
    """Chính sách hiện hành; kiểm tra rollout theo công ty bằng ``enabled_for``."""
    return resolve_job_ai_policy(get_settings_map(JOB_AI_POLICY_KEYS))


def _record_quota_rejection(*, model):
    """Đếm lượt bị chặn vì hết hạn mức; lỗi ghi số liệu không được thay phản hồi 429."""
    try:
        record_ai_quota_rejection(
            use_case=USE_CASE,
            provider=provider_name_for(settings.AI_PROVIDER_BACKEND),
            provider_backend=settings.AI_PROVIDER_BACKEND,
            model=model or settings.AI_JOB_GENERATION_MODEL,
        )
    except DatabaseError:
        logger.warning('Không ghi được số liệu AI quota rejection.', exc_info=True)


def create_job_ai_generation(*, user, validated_data):
    """Create one quota-consuming generation or replay the idempotent result.

    A new generation is queued for the worker once the transaction commits.
    """
    try:
        with transaction.atomic():
            generation, created, quota_remaining = _create_job_ai_generation_locked(
                user=user, validated_data=validated_data
            )
            if created:
                _dispatch_after_commit(generation)
            return generation, created, quota_remaining
    except JobAiGenerationQuotaExceeded as error:
        # The inner transaction (and recruiter lock) has ended before this PII-free metric write.
        _record_quota_rejection(model=error.model)
        raise


def _dispatch_after_commit(generation):
    generation_id, public_id = generation.pk, generation.public_id

    def dispatch():
        # Imported here: tasks depend on services, not the other way round.
        from ...tasks.ai_generation import generate_job_post

        try:
            generate_job_post.delay(generation_id)
        except Exception:  # noqa: BLE001 - stale-queued recovery will redispatch safely
            logger.exception('Không thể dispatch job AI generation %s.', public_id)

    transaction.on_commit(dispatch)


def _create_job_ai_generation_locked(*, user, validated_data):
    recruiter, _ = ensure_recruiter_job_workspace(user, lock=True)
    if recruiter is None or recruiter.company_id is None:
        raise JobAiGenerationUnavailable('employer_company_required')

    mode = validated_data['mode']
    locale = validated_data.get('locale', 'vi-VN')
    sanitized_input = sanitize_generation_input(validated_data)
    request_hash = _request_hash(mode, locale, sanitized_input)
    idempotency_key = validated_data['idempotency_key']
    existing = JobAiGeneration.objects.filter(
        owner=user,
        idempotency_key=idempotency_key,
    ).first()
    if existing is not None:
        if existing.request_hash != request_hash:
            raise JobAiIdempotencyConflict()
        return existing, False, job_ai_quota_remaining(user=user)

    policy = job_ai_policy()
    if not policy.enabled_for(recruiter.company):
        raise JobAiGenerationUnavailable()
    quota_day = vietnam_today()
    used = JobAiGeneration.objects.filter(owner=user, quota_day=quota_day).count()
    if used >= policy.daily_limit:
        raise JobAiGenerationQuotaExceeded(policy.daily_limit, model=policy.model)

    generation = JobAiGeneration.objects.create(
        owner=user,
        company=recruiter.company,
        mode=mode,
        locale=locale,
        sanitized_input=sanitized_input,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        quota_day=quota_day,
        model=policy.model,
        prompt_version=PROMPT_VERSION,
        schema_version=SCHEMA_VERSION,
    )
    return generation, True, max(policy.daily_limit - used - 1, 0)


def job_ai_quota_remaining(*, user, day=None):
    # Chưa từng tạo lượt nào thì chưa có workspace AI để hiển thị hạn mức.
    if not JobAiGeneration.objects.filter(owner=user).exists():
        return 0
    used = JobAiGeneration.objects.filter(owner=user, quota_day=day or vietnam_today()).count()
    return max(job_ai_policy().daily_limit - used, 0)
