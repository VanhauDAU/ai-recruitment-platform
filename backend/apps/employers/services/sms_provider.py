"""Provider-neutral SMS transport boundary for employer phone verification."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

import requests
from cryptography.fernet import Fernet
from django.conf import settings

logger = logging.getLogger(__name__)


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


class ConsoleSmsProvider:
    """Development only: writes the message to the worker log so a person can
    finish the real verification flow without an SMS gateway."""

    name = 'console'

    def send(self, message: SmsMessage) -> SmsDispatchReceipt:
        logger.warning(
            'SMS (console) to %s: %s',
            message.destination,
            ', '.join(f'{key}={value}' for key, value in message.template_parameters.items()),
        )
        return SmsDispatchReceipt(message_id=f'console-{message.idempotency_key}')


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


PRODUCTION_SMS_PROVIDERS = frozenset({'http', 'speedsms'})
SPEEDSMS_SEND_URL = 'https://api.speedsms.vn/index.php/sms/send'
# sms_type của SpeedSMS: 2 = đầu số ngẫu nhiên, 4 = brandname mặc định "Verify".
# Hai loại này không cần đăng ký brandname riêng nên không gửi kèm `sender`.
SPEEDSMS_SMS_TYPES = frozenset({2, 4})
SMS_SINGLE_SEGMENT_MAX_CHARS = 160
# Mã lỗi SpeedSMS (speedsms.vn/sms-api-service) → reason code log-safe.
_SPEEDSMS_ERROR_REASONS = {
    '105': 'provider_invalid_destination',
    '300': 'provider_insufficient_balance',
}


def render_sms_content(template_parameters):
    return settings.EMPLOYER_SMS_CONTENT_TEMPLATE.format(**template_parameters)


class SpeedSmsProvider:
    """SpeedSMS (speedsms.vn): Basic auth `token:x`, nội dung SMS dựng sẵn ở đây.

    SpeedSMS không có idempotency key; worker chỉ thử lại khi lỗi tạm và mỗi lần
    gửi cùng một mã nên tin trùng (nếu có) vẫn mang đúng mã."""

    name = 'speedsms'

    def __init__(self, *, session=None):
        self.session = session or requests.Session()

    def send(self, message: SmsMessage) -> SmsDispatchReceipt:
        payload = {
            'to': [message.destination.removeprefix('+')],
            'content': render_sms_content(message.template_parameters),
            'sms_type': settings.EMPLOYER_SMS_SPEEDSMS_TYPE,
            'sender': '',
        }
        try:
            response = self.session.post(
                SPEEDSMS_SEND_URL,
                auth=(settings.EMPLOYER_SMS_API_TOKEN, 'x'),
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
        if not isinstance(response_payload, dict):
            raise SmsProviderPermanentError('provider_invalid_response')
        if response_payload.get('status') != 'success':
            code = str(response_payload.get('code', '')).strip()
            if code == '500':
                raise SmsProviderTemporaryError()
            raise SmsProviderPermanentError(_SPEEDSMS_ERROR_REASONS.get(code, 'provider_rejected'))
        data = response_payload.get('data')
        transaction_id = data.get('tranId') if isinstance(data, dict) else None
        if transaction_id in (None, ''):
            raise SmsProviderPermanentError('provider_invalid_response')
        return SmsDispatchReceipt(message_id=f'speedsms-{transaction_id}'[:255])


def _content_template_errors():
    template = settings.EMPLOYER_SMS_CONTENT_TEMPLATE
    try:
        rendered = template.format(code='000000', ttl_minutes='10')
    except (KeyError, IndexError, ValueError):
        return ['EMPLOYER_SMS_CONTENT_TEMPLATE chỉ được dùng {code} và {ttl_minutes}.']
    errors = []
    if '{code}' not in template:
        errors.append('EMPLOYER_SMS_CONTENT_TEMPLATE phải chứa {code}.')
    if not rendered.isascii():
        errors.append('EMPLOYER_SMS_CONTENT_TEMPLATE phải viết không dấu (ASCII).')
    if len(rendered) > SMS_SINGLE_SEGMENT_MAX_CHARS:
        errors.append(
            f'EMPLOYER_SMS_CONTENT_TEMPLATE dài quá {SMS_SINGLE_SEGMENT_MAX_CHARS} ký tự.'
        )
    return errors


def sms_configuration_errors(*, require_enabled=False):
    """Return log-safe configuration errors without contacting a vendor."""

    errors = []
    enabled = settings.EMPLOYER_SMS_OTP_ENABLED
    if require_enabled and not enabled:
        errors.append('EMPLOYER_SMS_OTP_ENABLED đang tắt.')
    if not enabled:
        return errors

    provider = settings.EMPLOYER_SMS_PROVIDER
    if provider not in {'fake', 'console', 'http', 'speedsms'}:
        errors.append(
            'EMPLOYER_SMS_PROVIDER phải là fake, console, http hoặc speedsms khi bật SMS.'
        )
    if settings.IS_PRODUCTION and provider not in PRODUCTION_SMS_PROVIDERS:
        errors.append('Production chỉ cho phép EMPLOYER_SMS_PROVIDER=http hoặc speedsms.')
    if provider == 'speedsms':
        if not settings.EMPLOYER_SMS_API_TOKEN:
            errors.append('EMPLOYER_SMS_API_TOKEN (access token SpeedSMS) là bắt buộc.')
        if settings.EMPLOYER_SMS_SPEEDSMS_TYPE not in SPEEDSMS_SMS_TYPES:
            errors.append('EMPLOYER_SMS_SPEEDSMS_TYPE phải là 2 (đầu số) hoặc 4 (Verify).')
        errors.extend(_content_template_errors())
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
    jwt_signing_key = settings.SIMPLE_JWT.get('SIGNING_KEY', '')
    if settings.IS_PRODUCTION and encryption_key:
        if encryption_key in {settings.SECRET_KEY, jwt_signing_key} - {''}:
            errors.append(
                'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY không được dùng lại secret hệ thống khác.'
            )
    hmac_key = settings.EMPLOYER_SMS_CHALLENGE_HMAC_KEY
    if settings.IS_PRODUCTION and len(hmac_key) < 32:
        errors.append('EMPLOYER_SMS_CHALLENGE_HMAC_KEY phải có ít nhất 32 ký tự.')
    if settings.IS_PRODUCTION and hmac_key:
        if hmac_key in {
            settings.SECRET_KEY,
            jwt_signing_key,
            encryption_key,
        } - {''}:
            errors.append(
                'EMPLOYER_SMS_CHALLENGE_HMAC_KEY không được dùng lại secret hệ thống khác.'
            )
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
    if settings.EMPLOYER_SMS_PROVIDER == 'console':
        return ConsoleSmsProvider()
    if settings.EMPLOYER_SMS_PROVIDER == 'speedsms':
        return SpeedSmsProvider()
    return HttpSmsProvider()
