import hashlib
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from ..models import SpeechUsageDaily


class SpeechQuotaExceeded(Exception):
    def __init__(self, retry_after):
        self.retry_after = retry_after
        super().__init__('Daily speech generation quota exceeded.')


class SpeechQuotaUnavailable(Exception):
    pass


def reserve_generation_quota(*, artifact_key, surface, subject, authenticated, limit):
    reservation_key = f'speech:generation-reservation:{artifact_key}'
    try:
        reserved = cache.add(
            reservation_key,
            1,
            timeout=settings.SPEECH_GENERATION_RESERVATION_SECONDS,
        )
    except Exception as error:
        raise SpeechQuotaUnavailable from error
    if not reserved:
        return False

    local_date = timezone.localdate()
    subject_hash = hashlib.sha256(
        f'{"account" if authenticated else "ip"}:{subject}'.encode()
    ).hexdigest()
    quota_key = f'speech:daily:{local_date}:{surface}:{subject_hash}'
    timeout = _seconds_until_tomorrow()
    try:
        cache.add(quota_key, 0, timeout=timeout)
        used = cache.incr(quota_key)
    except Exception as error:
        try:
            cache.delete(reservation_key)
        except Exception:
            pass
        raise SpeechQuotaUnavailable from error
    if used <= limit:
        return True
    try:
        cache.decr(quota_key)
        cache.delete(reservation_key)
    except Exception:
        pass
    raise SpeechQuotaExceeded(timeout)


def record_speech_usage(surface, **increments):
    allowed = {
        'session_count',
        'generation_count',
        'requested_chars',
        'cache_hit_count',
        'cache_miss_count',
        'rejected_count',
        'unavailable_count',
        'durable_artifact_count',
        'durable_artifact_bytes',
        'durable_audio_ms',
    }
    values = {
        key: max(0, int(value)) for key, value in increments.items() if key in allowed and value
    }
    if not values:
        return
    current_date = timezone.localdate()
    try:
        with transaction.atomic():
            SpeechUsageDaily.objects.get_or_create(
                date=current_date,
                surface=surface,
            )
    except IntegrityError:
        pass
    SpeechUsageDaily.objects.filter(date=current_date, surface=surface).update(
        **{key: F(key) + value for key, value in values.items()}
    )


def _seconds_until_tomorrow():
    now = timezone.localtime()
    tomorrow = now.date() + timedelta(days=1)
    boundary = timezone.make_aware(datetime.combine(tomorrow, time.min))
    return max(60, int((boundary - now).total_seconds()))
