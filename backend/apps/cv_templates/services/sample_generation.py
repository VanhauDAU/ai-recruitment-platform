"""Sinh nội dung CV mẫu bằng AI cho admin duyệt (CVT-3, kế hoạch CVT-v3 mục 9.3).

Admin chọn vị trí × ngôn ngữ × nhóm kinh nghiệm; mỗi tổ hợp là một
`CvSampleGeneration` chạy trên hàng đợi `ai-generation` qua runtime `ai_core`
(ghi `AiInvocation`, không lưu prompt hay phản hồi). Kết quả là một
`CvSampleContent` ở trạng thái `in_review` — không có gì được xuất bản nếu admin
chưa duyệt. Prompt và cách đọc phản hồi nằm ở `sample_prompt.py`.
"""

from datetime import timedelta
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.ai_core.models import AiInvocation
from apps.ai_core.services import AiGenerationError, AiRuntimeConfig, generate_structured
from common.errors import DomainError

from ..models import CvPositionProfile, CvSampleContent, CvSampleGeneration, ExperienceBand
from .sample_prompt import (
    PROMPT_VERSION,
    RESPONSE_SCHEMA,
    SCHEMA_VERSION,
    SYSTEM_INSTRUCTION,
    build_prompt,
    generated_content,
    position_name,
    validate_generated,
)

USE_CASE = 'cv_sample_content'
MAX_BATCH_SIZE = 16
STALE_AFTER = timedelta(minutes=10)


class SampleGenerationUnavailable(DomainError):
    """Yêu cầu sinh không hợp lệ hoặc runtime AI chưa sẵn sàng (mã lỗi an toàn).

    Client nhận `{"code": ...}`: runtime chưa bật/cấu hình là 503, đang có lượt
    sinh chiếm chỗ là 409, còn lại là 400.
    """

    STATUS_BY_CODE = {
        'runtime_disabled': 503,
        'provider_not_configured': 503,
        'generation_in_progress': 409,
    }

    def __init__(self, code):
        self.code = code
        self.status_code = self.STATUS_BY_CODE.get(code, 400)
        super().__init__(code)

    def payload(self):
        return {'code': self.code}


def _ensure_runtime_ready():
    try:
        AiRuntimeConfig.from_django_settings().validate()
    except AiGenerationError as error:
        raise SampleGenerationUnavailable(error.code) from error


@transaction.atomic
def request_sample_generations(*, actor, profiles, locales, bands):
    """Tạo một lượt sinh cho mỗi tổ hợp và xếp hàng sau khi commit."""
    combinations = [
        (profile, locale, band) for profile in profiles for locale in locales for band in bands
    ]
    if not combinations:
        raise SampleGenerationUnavailable('empty_batch')
    if len(combinations) > MAX_BATCH_SIZE:
        raise SampleGenerationUnavailable('batch_too_large')
    _ensure_runtime_ready()
    # Lượt bị treo (worker chết giữa chừng) không được chặn các lượt mới mãi mãi.
    CvSampleGeneration.objects.filter(
        status__in=[CvSampleGeneration.Status.QUEUED, CvSampleGeneration.Status.PROCESSING],
        updated_at__lt=timezone.now() - STALE_AFTER,
    ).update(
        status=CvSampleGeneration.Status.FAILED, failure_code='stale', finished_at=timezone.now()
    )
    active = CvSampleGeneration.objects.filter(
        status__in=[CvSampleGeneration.Status.QUEUED, CvSampleGeneration.Status.PROCESSING]
    ).count()
    if active + len(combinations) > MAX_BATCH_SIZE:
        raise SampleGenerationUnavailable('generation_in_progress')
    batch_id = f'cvbatch_{uuid4().hex[:16]}'
    generations = [
        CvSampleGeneration.objects.create(
            batch_id=batch_id,
            position_profile=profile,
            locale=locale,
            experience_band=band,
            requested_by=actor,
        )
        for profile, locale, band in combinations
    ]

    def dispatch():
        from apps.cv_templates.tasks.template_assets import generate_cv_sample_content

        for generation in generations:
            generate_cv_sample_content.delay(generation.pk)

    transaction.on_commit(dispatch)
    return generations


@transaction.atomic
def _claim(generation_id):
    generation = (
        CvSampleGeneration.objects.select_for_update()
        .filter(pk=generation_id, status=CvSampleGeneration.Status.QUEUED)
        .first()
    )
    if generation is None:
        return None
    generation.status = CvSampleGeneration.Status.PROCESSING
    generation.save(update_fields=['status', 'updated_at'])
    return generation


def fail_sample_generation(generation_id, *, code, invocation_id=None):
    CvSampleGeneration.objects.filter(
        pk=generation_id,
        status__in=[CvSampleGeneration.Status.QUEUED, CvSampleGeneration.Status.PROCESSING],
    ).update(
        status=CvSampleGeneration.Status.FAILED,
        failure_code=code[:64],
        invocation_id=invocation_id,
        finished_at=timezone.now(),
        updated_at=timezone.now(),
    )


def execute_sample_generation(generation_id):
    """Chạy một lượt sinh; kết quả là nội dung mẫu chờ duyệt, lỗi chỉ lưu mã."""
    generation = _claim(generation_id)
    if generation is None:
        return None
    profile = (
        CvPositionProfile.objects.select_related('job_category')
        .prefetch_related('fields')
        .get(pk=generation.position_profile_id)
    )
    locale, band = generation.locale, generation.experience_band
    try:
        result = generate_structured(
            use_case=USE_CASE,
            prompt=build_prompt(profile, locale, band),
            response_schema=RESPONSE_SCHEMA,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
            system_instruction=SYSTEM_INSTRUCTION,
            result_validator=validate_generated,
            correlation_key=generation.public_id,
        )
    except AiGenerationError as error:
        fail_sample_generation(generation.pk, code=error.code, invocation_id=error.invocation_id)
        return None
    try:
        content = generated_content(profile, locale, result.data)
    except (ValidationError, KeyError, TypeError):
        fail_sample_generation(
            generation.pk, code='invalid_document', invocation_id=result.invocation_id
        )
        return None
    with transaction.atomic():
        sample = CvSampleContent.objects.create(
            position_profile=profile,
            locale=locale,
            experience_band=band,
            title=f'{position_name(profile, locale)} · {ExperienceBand(band).label}',
            content_json=content,
            status=CvSampleContent.Status.IN_REVIEW,
            origin=CvSampleContent.Origin.AI,
            created_by=generation.requested_by,
        )
        CvSampleGeneration.objects.filter(pk=generation.pk).update(
            status=CvSampleGeneration.Status.COMPLETED,
            sample=sample,
            invocation_id=result.invocation_id,
            finished_at=timezone.now(),
            updated_at=timezone.now(),
        )
    return sample


def average_generation_cost(sample_size=50):
    """Chi phí trung bình (USD) của các lượt sinh thành công gần nhất; `None` nếu chưa có."""
    costs = list(
        AiInvocation.objects.filter(use_case=USE_CASE, status=AiInvocation.Status.SUCCEEDED)
        .order_by('-created_at')
        .values_list('cost_usd', flat=True)[:sample_size]
    )
    return round(float(sum(costs)) / len(costs), 6) if costs else None


def estimate_generation_cost(count):
    """Chi phí ước tính cho `count` lượt (kẹp trong 1..MAX_BATCH_SIZE) theo `average_generation_cost`."""
    count = max(1, min(MAX_BATCH_SIZE, count))
    average = average_generation_cost()
    return {
        'count': count,
        'average_cost_usd': average,
        'estimated_cost_usd': round(average * count, 4) if average is not None else None,
    }
