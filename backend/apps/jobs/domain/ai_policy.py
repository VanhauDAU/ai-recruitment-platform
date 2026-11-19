"""Chính sách tạo tin bằng AI: một nơi duy nhất tính công tắc, model và hạn mức.

Biến môi trường là trần cứng (kill switch, allowlist model, hạn mức ngày); cấu hình
site do admin chỉnh chỉ được thu hẹp trong trần đó. Luồng tạo tin (services) và
dashboard admin (selectors) cùng đọc kết quả ở đây để hai bên không lệch nhau.
"""

import hashlib
from dataclasses import dataclass

from django.conf import settings

from common.api.params import parse_bool, parse_int

JOB_AI_POLICY_KEYS = (
    'ai_job_generation_enabled',
    'ai_job_generation_model',
    'ai_job_generation_daily_limit',
    'ai_job_generation_rollout_percent',
    'ai_job_generation_company_allowlist',
    'ai_job_generation_model_allowlist',
)


def _string_list(value):
    """Danh sách chuỗi từ JSON list/tuple hoặc chuỗi phân tách dấu phẩy (form admin)."""
    if isinstance(value, str):
        value = value.split(',')
    if not isinstance(value, list | tuple):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


@dataclass(frozen=True, slots=True)
class JobAiPolicy:
    hard_switch_enabled: bool
    soft_switch_enabled: bool
    requested_model: str
    # Rỗng khi model admin chọn nằm ngoài allowlist: tính năng tắt chứ không tự đổi model.
    model: str
    allowed_models: tuple[str, ...]
    daily_limit: int
    rollout_percent: int
    company_allowlist: frozenset[str]

    @property
    def enabled(self):
        return self.hard_switch_enabled and self.soft_switch_enabled and bool(self.model)

    def allows_company(self, public_id):
        # Băm ổn định để một công ty luôn rơi cùng nhóm khi tăng dần tỷ lệ rollout.
        bucket = int(hashlib.sha256(public_id.encode()).hexdigest()[:8], 16) % 100
        return public_id in self.company_allowlist or bucket < self.rollout_percent

    def enabled_for(self, company):
        return self.enabled and self.allows_company(company.public_id)


def resolve_job_ai_policy(site_values):
    """Áp cấu hình site (``key -> value`` của ``JOB_AI_POLICY_KEYS``) dưới trần môi trường."""
    env_model = settings.AI_JOB_GENERATION_MODEL
    env_models = _string_list(settings.AI_JOB_GENERATION_MODEL_ALLOWLIST) or [env_model]
    site_models = _string_list(site_values.get('ai_job_generation_model_allowlist'))
    allowed_models = tuple(model for model in env_models if not site_models or model in site_models)
    requested_model = str(site_values.get('ai_job_generation_model') or env_model).strip()
    env_daily_limit = max(settings.AI_JOB_GENERATION_DAILY_LIMIT, 0)
    return JobAiPolicy(
        # So ``is True`` để giá trị lạ (chuỗi do override) không vô tình mở kill switch.
        hard_switch_enabled=settings.AI_RUNTIME_ENABLED is True,
        soft_switch_enabled=parse_bool(site_values.get('ai_job_generation_enabled'), False),
        requested_model=requested_model,
        model=requested_model if requested_model in allowed_models else '',
        allowed_models=allowed_models,
        daily_limit=parse_int(
            site_values.get('ai_job_generation_daily_limit'),
            env_daily_limit,
            minimum=0,
            maximum=env_daily_limit,
        ),
        rollout_percent=parse_int(
            site_values.get('ai_job_generation_rollout_percent'), 0, minimum=0, maximum=100
        ),
        company_allowlist=frozenset(
            _string_list(site_values.get('ai_job_generation_company_allowlist'))
        ),
    )
