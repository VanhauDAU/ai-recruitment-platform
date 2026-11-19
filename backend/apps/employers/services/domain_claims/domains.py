"""Company domain rules: normalisation, the public-email exclusion and the DNS TXT challenge."""

import hashlib
import secrets

import idna
from django.conf import settings

from apps.employers.domain.company_email import PUBLIC_EMAIL_DOMAINS

TXT_PREFIX = 'procv-verification='


class DomainClaimError(ValueError):
    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def _offline_tld_extract(domain):
    """Resolve a registrable suffix without downloading the PSL at runtime."""

    try:
        import tldextract
    except ImportError as error:
        raise DomainClaimError(
            'domain_validation_unavailable',
            'Dịch vụ kiểm tra hậu tố tên miền chưa sẵn sàng.',
        ) from error
    result = tldextract.TLDExtract(suffix_list_urls=())(domain)
    return bool(result.domain and result.suffix)


def normalize_company_domain(value):
    """Return one exact lower-case IDNA ASCII domain or fail closed."""

    candidate = (value or '').strip().rstrip('.').lower()
    if not candidate or '@' in candidate or candidate.startswith('*.'):
        raise DomainClaimError('invalid_domain', 'Tên miền không hợp lệ.')
    try:
        normalized = idna.encode(candidate, uts46=True, std3_rules=True).decode('ascii')
    except (idna.IDNAError, UnicodeError) as error:
        raise DomainClaimError('invalid_domain', 'Tên miền không hợp lệ.') from error
    if len(normalized) > 253 or any(len(label) > 63 for label in normalized.split('.')):
        raise DomainClaimError('invalid_domain', 'Tên miền không hợp lệ.')
    if not _offline_tld_extract(normalized):
        raise DomainClaimError('public_suffix', 'Tên miền phải có hậu tố công khai hợp lệ.')
    if normalized in PUBLIC_EMAIL_DOMAINS:
        raise DomainClaimError(
            'public_email_domain',
            'Không thể xác minh tên miền của dịch vụ email công cộng.',
        )
    return normalized


def verified_email_domain(user):
    if not user.email_verified:
        raise DomainClaimError(
            'email_not_verified',
            'Hãy xác thực email công việc trước khi xác minh tên miền.',
        )
    _, separator, raw_domain = (user.email or '').strip().rpartition('@')
    if not separator:
        raise DomainClaimError('invalid_email', 'Email hiện tại không hợp lệ.')
    return normalize_company_domain(raw_domain)


def _token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def new_challenge():
    token = secrets.token_urlsafe(32)
    return token, _token_hash(token)


def domain_claim_txt_name(domain):
    return f'_procv-verification.{domain}'


def domain_claim_txt_value(token):
    return f'{TXT_PREFIX}{token}'


def dns_txt_values(name):
    """Read TXT records with a bounded resolver lifetime."""

    try:
        import dns.exception
        import dns.resolver
    except ImportError as error:
        raise DomainClaimError(
            'dns_unavailable',
            'Dịch vụ kiểm tra DNS chưa sẵn sàng.',
        ) from error
    resolver = dns.resolver.Resolver(configure=True)
    resolver.lifetime = settings.EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS
    try:
        answers = resolver.resolve(name, 'TXT')
    except (dns.exception.DNSException, OSError) as error:
        raise DomainClaimError('dns_check_failed', 'Chưa tìm thấy bản ghi TXT hợp lệ.') from error
    values = set()
    for answer in answers:
        strings = getattr(answer, 'strings', None)
        if strings is not None:
            values.add(b''.join(strings).decode('utf-8', errors='replace').strip())
        else:
            values.add(answer.to_text().strip().strip('"'))
    return values


def txt_matches(claim, values):
    for value in values:
        if not value.startswith(TXT_PREFIX):
            continue
        if secrets.compare_digest(
            _token_hash(value.removeprefix(TXT_PREFIX).strip()), claim.token_hash
        ):
            return True
    return False
