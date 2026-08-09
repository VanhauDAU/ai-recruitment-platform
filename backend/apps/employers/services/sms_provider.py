"""Provider-neutral SMS transport boundary for employer phone verification."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

import requests
from cryptography.fernet import Fernet
from django.conf import settings


class SmsProviderError(Exception):
    """Base error containing only a stable, log-safe reason code."""

    reason_code = 'provider_error'
    retryable = False

    def __init__(self, reason_code=None):
        self.reason_code = reason_code or self.reason_code
        super().__init__(self.reason_code)


class SmsProviderDisabled(SmsProviderError):
    reason_code = 'provider_disabled'


class SmsProviderMisconfigured(SmsProviderError):
    reason_code = 'provider_misconfigured'


class SmsProviderTemporaryError(SmsProviderError):
    reason_code = 'provider_unavailable'
    retryable = True


class SmsProviderPermanentError(SmsProviderError):
    reason_code = 'provider_rejected'


@dataclass(frozen=True)
class SmsMessage:
    destination: str
    template_id: str
    template_parameters: dict[str, str]
    sender: str
    idempotency_key: str


@dataclass(frozen=True)
class SmsDispatchReceipt:
    message_id: str


class SmsProvider(Protocol):
    name: str

    def send(self, message: SmsMessage) -> SmsDispatchReceipt: ...


class DisabledSmsProvider:
    name = 'disabled'

    def send(self, message: SmsMessage) -> SmsDispatchReceipt:
        del message
        raise SmsProviderDisabled()


class FakeSmsProvider:
    """In-memory provider for development and tests; never enabled in production."""

    name = 'fake'

    def __init__(self):
        self.outbox: list[SmsMessage] = []

    def send(self, message: SmsMessage) -> SmsDispatchReceipt:
        self.outbox.append(message)
        return SmsDispatchReceipt(message_id=f'fake-{message.idempotency_key}')


class HttpSmsProvider:
    """Generic JSON-over-HTTP adapter to a separately selected SMS gateway."""

    name = 'http'

    def __init__(self, *, session=None):
        self.session = session or requests.Session()

    def send(self, message: SmsMessage) -> SmsDispatchReceipt:
        headers = {
            'Authorization': f'Bearer {settings.EMPLOYER_SMS_API_TOKEN}',
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotency_key,
        }
        payload = {
            'to': message.destination,
            'sender': message.sender,
            'template_id': message.template_id,
            'template_parameters': message.template_parameters,
        }
        try:
            response = self.session.post(
                settings.EMPLOYER_SMS_ENDPOINT_URL,
                headers=headers,
                json=payload,
                timeout=(
                    settings.EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS,
                    settings.EMPLOYER_SMS_READ_TIMEOUT_SECONDS,
                ),
                allow_redirects=False,
            )
        except (requests.Timeout, requests.ConnectionError) as error:
            raise SmsProviderTemporaryError() from error
        except requests.RequestException as error:
            raise SmsProviderPermanentError('provider_request_error') from error

        if response.status_code == 429 or response.status_code >= 500:
            raise SmsProviderTemporaryError()
        if response.status_code < 200 or response.status_code >= 300:
            raise SmsProviderPermanentError()
        try:
            response_payload = response.json()
        except ValueError as error:
            raise SmsProviderPermanentError('provider_invalid_response') from error
        message_id = response_payload.get('message_id')
        if not isinstance(message_id, str) or not message_id.strip():
            raise SmsProviderPermanentError('provider_invalid_response')
        return SmsDispatchReceipt(message_id=message_id.strip()[:255])


def sms_configuration_errors(*, require_enabled=False):
    """Return log-safe configuration errors without contacting a vendor."""

    errors = []
    enabled = settings.EMPLOYER_SMS_OTP_ENABLED
    if require_enabled and not enabled:
        errors.append('EMPLOYER_SMS_OTP_ENABLED đang tắt.')
    if not enabled:
        return errors

    provider = settings.EMPLOYER_SMS_PROVIDER
    if provider not in {'fake', 'http'}:
        errors.append('EMPLOYER_SMS_PROVIDER phải là fake hoặc http khi bật SMS.')
    if settings.IS_PRODUCTION and provider != 'http':
        errors.append('Production chỉ cho phép EMPLOYER_SMS_PROVIDER=http.')
    if provider == 'http':
        endpoint = settings.EMPLOYER_SMS_ENDPOINT_URL
        if not endpoint:
            errors.append('EMPLOYER_SMS_ENDPOINT_URL là bắt buộc.')
        elif settings.IS_PRODUCTION and urlparse(endpoint).scheme != 'https':
            errors.append('EMPLOYER_SMS_ENDPOINT_URL production phải dùng HTTPS.')
        if not settings.EMPLOYER_SMS_API_TOKEN:
            errors.append('EMPLOYER_SMS_API_TOKEN là bắt buộc.')
        if not settings.EMPLOYER_SMS_SENDER:
            errors.append('EMPLOYER_SMS_SENDER là bắt buộc.')
        if not settings.EMPLOYER_SMS_TEMPLATE_ID:
            errors.append('EMPLOYER_SMS_TEMPLATE_ID là bắt buộc.')
    encryption_key = settings.EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY
    if settings.IS_PRODUCTION and not encryption_key:
        errors.append('EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY là bắt buộc.')
    elif encryption_key:
        try:
            Fernet(encryption_key.encode())
        except (TypeError, ValueError):
            errors.append('EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY không phải Fernet key hợp lệ.')
    if settings.IS_PRODUCTION and len(settings.EMPLOYER_SMS_CHALLENGE_HMAC_KEY) < 32:
        errors.append('EMPLOYER_SMS_CHALLENGE_HMAC_KEY phải có ít nhất 32 ký tự.')
    if settings.EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS <= 0:
        errors.append('EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS phải lớn hơn 0.')
    if settings.EMPLOYER_SMS_READ_TIMEOUT_SECONDS <= 0:
        errors.append('EMPLOYER_SMS_READ_TIMEOUT_SECONDS phải lớn hơn 0.')
    return errors


def get_sms_provider() -> SmsProvider:
    errors = sms_configuration_errors(require_enabled=True)
    if errors:
        if not settings.EMPLOYER_SMS_OTP_ENABLED:
            return DisabledSmsProvider()
        raise SmsProviderMisconfigured()
    if settings.EMPLOYER_SMS_PROVIDER == 'fake':
        return FakeSmsProvider()
    return HttpSmsProvider()
