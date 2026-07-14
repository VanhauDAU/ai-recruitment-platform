"""Shared HTTP deprecation signalling for legacy API contracts.

The mixin keeps a legacy endpoint operational while clients migrate.  It emits
standards-based response headers and a privacy-minimised event that operations
can route to metrics from the normal application log pipeline.
"""

import logging

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.http import http_date


logger = logging.getLogger(__name__)


def _configured_datetime(setting_name):
    value = getattr(settings, setting_name, '')
    parsed = parse_datetime(value) if value else None
    if parsed is None:
        raise ImproperlyConfigured(f'{setting_name} must be an ISO-8601 datetime.')
    return timezone.make_aware(parsed) if timezone.is_naive(parsed) else parsed


class LegacyApiDeprecationMixin:
    """Add deprecation headers and an endpoint-level telemetry event.

    Subclasses declare the successor path.  Raw URL paths, user agents and
    actor identifiers are deliberately excluded from the log event.
    """

    deprecation_contract = 'legacy-api'
    deprecation_successor = '/api/v2/'

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        deprecated_at = _configured_datetime('LEGACY_CV_API_DEPRECATION_AT')
        sunset_at = _configured_datetime('LEGACY_CV_API_SUNSET_AT')
        response['Deprecation'] = f'@{int(deprecated_at.timestamp())}'
        response['Sunset'] = http_date(sunset_at.timestamp())
        response['Link'] = f'<{self.deprecation_successor}>; rel="successor-version"'
        logger.info(
            'deprecated_api_request',
            extra={
                'event': 'deprecated_api_request',
                'api_contract': self.deprecation_contract,
                'api_successor': self.deprecation_successor,
                'http_method': request.method,
                'http_status': response.status_code,
                'authenticated': bool(getattr(request.user, 'is_authenticated', False)),
            },
        )
        return response
