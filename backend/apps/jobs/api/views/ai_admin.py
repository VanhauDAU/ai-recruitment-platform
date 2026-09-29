"""Superuser-only operational overview for AI-assisted job generation."""

from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from apps.ai_core.services import AiRuntimeConfig

from ...selectors import (
    job_ai_admin_overview,
    job_ai_admin_policy_overview,
    job_ai_queue_overview,
    job_ai_usage_overview,
)


def _bounded_days(value):
    try:
        return min(max(int(value), 7), 365)
    except (TypeError, ValueError):
        return 30


def _usage_window(days):
    usage = job_ai_usage_overview(days=days)
    terminal = usage['success_count'] + usage['failure_count']
    return {
        **usage,
        'success_rate': round(usage['success_count'] / terminal, 4) if terminal else 0.0,
    }


def _runtime_overview(policy):
    config = AiRuntimeConfig.from_django_settings(model=policy['model'])
    if config.provider_backend == 'vertex':
        credential_configured = bool(config.google_cloud_project and config.google_cloud_location)
    else:
        credential_configured = bool(config.gemini_api_key)
    if not config.enabled:
        status = 'disabled'
    elif not credential_configured or not policy['model_allowed']:
        status = 'degraded'
    else:
        status = 'ready'
    return {
        'status': status,
        'enabled': config.enabled,
        'provider': 'gemini',
        'provider_backend': config.provider_backend,
        'model': config.model,
        'credential_configured': credential_configured,
        'api_version': config.api_version,
        'timeout_seconds': config.timeout_seconds,
        'max_attempts': config.max_attempts,
    }


class AdminAiOverviewView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['site_setting.view']}
    require_superuser = True

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name='days',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Cửa sổ dài cho số liệu; 7–365 ngày, mặc định 30.',
            )
        ],
        responses={200: OpenApiTypes.OBJECT},
        tags=['ai-admin'],
    )
    def get(self, request):
        days = _bounded_days(request.query_params.get('days', 30))
        policy = job_ai_admin_policy_overview()
        long_usage = _usage_window(days)
        long_generations = job_ai_admin_overview(days=days)
        response = Response(
            {
                'runtime': _runtime_overview(policy),
                'queue': job_ai_queue_overview(),
                'policy': policy,
                'usage': {
                    'days_7': _usage_window(7),
                    f'days_{days}': long_usage,
                    'days_30': long_usage if days == 30 else _usage_window(30),
                },
                'generations': {
                    'days_7': job_ai_admin_overview(days=7),
                    f'days_{days}': long_generations,
                    'days_30': (long_generations if days == 30 else job_ai_admin_overview(days=30)),
                },
                'retention': {
                    'content_days': settings.AI_JOB_GENERATION_CONTENT_RETENTION_DAYS,
                    'metadata_days': settings.AI_INVOCATION_METADATA_RETENTION_DAYS,
                },
            }
        )
        response['Cache-Control'] = 'private, no-store'
        return response
