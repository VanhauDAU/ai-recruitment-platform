"""VietQR company-tax lookup and immutable workflow evidence."""

import hashlib
import json
import re
from dataclasses import dataclass
from urllib.parse import quote

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.accounts.services import record_admin_action

from ..models import CompanyTaxLookupEvidence, EmployerVerificationEvent
from .company_update_locks import lock_company_update_request
from .compliance import lock_verification_identity

TAX_CODE_PATTERN = re.compile(r'\d{10}(?:-\d{3})?')


class TaxLookupError(Exception):
    """Base error for upstream lookup failures."""


class TaxLookupUnavailable(TaxLookupError):
    """Transient provider/network failure."""


class TaxLookupRateLimited(TaxLookupUnavailable):
    def __init__(self, retry_after=60):
        super().__init__('vietqr_rate_limited')
        self.retry_after = retry_after


@dataclass(frozen=True)
class TaxLookupResult:
    status: str
    returned_tax_code: str = ''
    registered_name: str = ''
    international_name: str = ''
    short_name: str = ''
    provider_code: str = ''
    provider_description: str = ''
    response_hash: str = ''

    def as_dict(self):
        return {
            'status': self.status,
            'returned_tax_code': self.returned_tax_code,
            'registered_name': self.registered_name,
            'international_name': self.international_name,
            'short_name': self.short_name,
            'provider_code': self.provider_code,
            'provider_description': self.provider_description,
            'response_hash': self.response_hash,
        }


def normalize_tax_code(value):
    normalized = re.sub(r'\s+', '', str(value or ''))
    if not TAX_CODE_PATTERN.fullmatch(normalized):
        raise ValueError('invalid_tax_code')
    return normalized


def _response_hash(payload):
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def _cache_key(tax_code):
    digest = hashlib.sha256(tax_code.encode('utf-8')).hexdigest()
    return f'employers:tax-lookup:vietqr:{digest}'


def _cache_get(key):
    try:
        return cache.get(key)
    except Exception:  # noqa: BLE001 - cache outage must not break provider lookup
        return None


def _cache_set(key, value, timeout):
    try:
        cache.set(key, value, timeout)
    except Exception:  # noqa: BLE001 - evidence is still persisted without caching
        return


def _bounded_text(value, limit):
    return str(value or '').strip()[:limit]


def lookup_company_tax(tax_code):
    """Return a normalized VietQR result; never expose the raw provider payload."""
    tax_code = normalize_tax_code(tax_code)
    cache_key = _cache_key(tax_code)
    cached = _cache_get(cache_key)
    if cached:
        return TaxLookupResult(**cached)

    if not settings.VIETQR_TAX_LOOKUP_ENABLED:
        raise TaxLookupUnavailable('vietqr_disabled')

    endpoint = f'{settings.VIETQR_TAX_LOOKUP_BASE_URL.rstrip("/")}/{quote(tax_code, safe="-")}'
    try:
        response = requests.get(
            endpoint,
            timeout=(
                settings.VIETQR_TAX_LOOKUP_CONNECT_TIMEOUT,
                settings.VIETQR_TAX_LOOKUP_READ_TIMEOUT,
            ),
        )
    except requests.RequestException as error:
        raise TaxLookupUnavailable('vietqr_request_failed') from error

    if response.status_code == 429:
        try:
            retry_after = max(1, min(int(response.headers.get('Retry-After', '60')), 3600))
        except (TypeError, ValueError):
            retry_after = 60
        raise TaxLookupRateLimited(retry_after=retry_after)
    if response.status_code == 404:
        result = TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.NOT_FOUND,
            provider_code='404',
            provider_description='Không tìm thấy mã số thuế.',
        )
        _cache_set(cache_key, result.as_dict(), settings.VIETQR_TAX_LOOKUP_NEGATIVE_TTL)
        return result
    if response.status_code >= 500:
        raise TaxLookupUnavailable(f'vietqr_http_{response.status_code}')
    if response.status_code >= 400:
        return TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.INVALID_RESPONSE,
            provider_code=str(response.status_code),
            provider_description='VietQR từ chối yêu cầu tra cứu.',
        )

    try:
        payload = response.json()
    except ValueError:
        return TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.INVALID_RESPONSE,
            provider_description='VietQR trả về dữ liệu không phải JSON.',
        )
    if not isinstance(payload, dict):
        return TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.INVALID_RESPONSE,
            provider_description='Cấu trúc phản hồi VietQR không hợp lệ.',
            response_hash=_response_hash(payload),
        )

    provider_code = _bounded_text(payload.get('code'), 40)
    provider_description = _bounded_text(payload.get('desc'), 500)
    data = payload.get('data')
    if provider_code != '00' or not isinstance(data, dict):
        result = TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.NOT_FOUND,
            provider_code=provider_code,
            provider_description=provider_description or 'Không tìm thấy mã số thuế.',
            response_hash=_response_hash(payload),
        )
        _cache_set(cache_key, result.as_dict(), settings.VIETQR_TAX_LOOKUP_NEGATIVE_TTL)
        return result

    returned_tax_code = re.sub(r'\s+', '', _bounded_text(data.get('id'), 100))
    if returned_tax_code != tax_code:
        return TaxLookupResult(
            status=CompanyTaxLookupEvidence.Status.INVALID_RESPONSE,
            returned_tax_code=returned_tax_code,
            provider_code=provider_code,
            provider_description='Mã số thuế VietQR trả về không khớp yêu cầu.',
            response_hash=_response_hash(payload),
        )

    result = TaxLookupResult(
        status=CompanyTaxLookupEvidence.Status.FOUND,
        returned_tax_code=returned_tax_code,
        registered_name=_bounded_text(data.get('name'), 255),
        international_name=_bounded_text(data.get('internationalName'), 255),
        short_name=_bounded_text(data.get('shortName'), 255),
        provider_code=provider_code,
        provider_description=provider_description,
        response_hash=_response_hash(payload),
    )
    _cache_set(cache_key, result.as_dict(), settings.VIETQR_TAX_LOOKUP_SUCCESS_TTL)
    return result


def queue_company_tax_lookup(
    *,
    company,
    requested_by,
    workflow_revision,
    verification_case=None,
    update_request=None,
    tax_code=None,
    company_name=None,
):
    """Create one pending evidence row and dispatch lookup after commit."""
    if bool(verification_case) == bool(update_request):
        raise ValueError('exactly_one_tax_lookup_workflow_is_required')
    normalized_tax_code = normalize_tax_code(tax_code or company.tax_code)
    evidence = CompanyTaxLookupEvidence.objects.create(
        company=company,
        verification_case=verification_case,
        update_request=update_request,
        requested_by=requested_by,
        workflow_revision=workflow_revision,
        tax_code=normalized_tax_code,
        submitted_company_name=(company_name or company.company_name).strip(),
    )

    def dispatch():
        from ..tasks import lookup_company_tax_evidence

        try:
            lookup_company_tax_evidence.delay(evidence.pk)
        except Exception:  # noqa: BLE001 - broker outage must not fail submission
            CompanyTaxLookupEvidence.objects.filter(
                pk=evidence.pk,
                status=CompanyTaxLookupEvidence.Status.PENDING,
            ).update(
                status=CompanyTaxLookupEvidence.Status.UNAVAILABLE,
                provider_description='Không thể xếp lịch tra cứu VietQR.',
                completed_at=timezone.now(),
                updated_at=timezone.now(),
            )

    transaction.on_commit(dispatch)
    return evidence


def latest_tax_lookup_evidence(workflow):
    relation = workflow.tax_lookup_evidences
    return (
        relation.filter(workflow_revision=workflow.revision).order_by('-created_at', '-id').first()
    )


@transaction.atomic
def refresh_verification_tax_lookup(case, *, actor):
    scope = lock_verification_identity(case)
    case = scope.case
    if scope.company is None or not scope.company.tax_code:
        raise ValueError('company_tax_code_is_required')
    case.lock_version += 1
    case.save(update_fields=['lock_version', 'updated_at'])
    evidence = queue_company_tax_lookup(
        company=scope.company,
        requested_by=actor,
        verification_case=case,
        workflow_revision=case.revision,
    )
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=EmployerVerificationEvent.EventType.TAX_LOOKUP_REFRESHED,
        payload={
            'evidence_public_id': evidence.public_id,
            'revision': case.revision,
            'requested_at': timezone.now().isoformat(),
        },
    )
    record_admin_action(
        actor=actor,
        action='refresh_employer_tax_lookup',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={'evidence_public_id': evidence.public_id},
    )
    return case, evidence


@transaction.atomic
def refresh_company_update_tax_lookup(update_request, *, actor):
    company, update_request = lock_company_update_request(
        company_id=update_request.company_id,
        update_request_id=update_request.pk,
    )
    if not update_request.is_sensitive:
        raise ValueError('tax_lookup_only_applies_to_sensitive_updates')
    proposed_tax_code = update_request.changes.get('tax_code', company.tax_code)
    if not proposed_tax_code:
        raise ValueError('company_tax_code_is_required')
    update_request.lock_version += 1
    update_request.save(update_fields=['lock_version', 'updated_at'])
    evidence = queue_company_tax_lookup(
        company=company,
        requested_by=actor,
        update_request=update_request,
        workflow_revision=update_request.revision,
        tax_code=proposed_tax_code,
        company_name=update_request.changes.get('company_name', company.company_name),
    )
    record_admin_action(
        actor=actor,
        action='refresh_company_update_tax_lookup',
        target_type='company_update_request',
        target_public_id=update_request.public_id,
        payload={'evidence_public_id': evidence.public_id},
    )
    return update_request, evidence
