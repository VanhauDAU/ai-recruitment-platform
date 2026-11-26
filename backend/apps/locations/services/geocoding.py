"""Provider-neutral geocoding boundary (ADR-0029).

Geoapify is the production provider: self-serve key, free daily quota, Vietnam-only
filter. Nominatim is for development without a key. A new provider implements
``GeocodingProvider`` and registers in ``_PROVIDERS``. Every provider call goes
through ``GeocodeCache`` so re-saving a job or re-selecting a suggestion costs
nothing.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from ..domain import is_in_vietnam, normalize_geocode_key
from ..models import GeocodeCache

logger = logging.getLogger(__name__)

FOUND_TTL = timedelta(days=180)
NOT_FOUND_TTL = timedelta(days=7)
AUTOCOMPLETE_LIMIT = 6


class GeocodingError(Exception):
    reason_code = 'provider_error'


class GeocodingDisabled(GeocodingError):
    reason_code = 'provider_disabled'


class GeocodingUnavailable(GeocodingError):
    """Timeout, 5xx or 429: worth retrying later."""

    reason_code = 'provider_unavailable'


@dataclass(frozen=True)
class GeoPoint:
    latitude: float
    longitude: float
    label: str = ''


@dataclass(frozen=True)
class PlaceSuggestion:
    ref: str
    label: str
    secondary: str = ''


class GeocodingProvider(Protocol):
    name: str

    def geocode(self, text: str) -> GeoPoint | None: ...

    def autocomplete(
        self, text: str, focus: tuple[float, float] | None
    ) -> list[PlaceSuggestion]: ...

    def place(self, ref: str) -> GeoPoint | None: ...


class _HttpProvider:
    name = 'http'

    def __init__(self, *, session=None):
        self.session = session or requests.Session()

    def _get(self, url, params):
        try:
            response = self.session.get(
                url,
                params=params,
                timeout=settings.GEOCODING_TIMEOUT_SECONDS,
                headers={'User-Agent': settings.GEOCODING_USER_AGENT},
            )
        except requests.RequestException as error:
            raise GeocodingUnavailable() from error
        if response.status_code == 429 or response.status_code >= 500:
            raise GeocodingUnavailable()
        if response.status_code >= 400:
            logger.warning(
                'Geocoding %s rejected request: HTTP %s', self.name, response.status_code
            )
            raise GeocodingError()
        try:
            return response.json()
        except ValueError as error:
            raise GeocodingUnavailable() from error


def _point(lat, lng, label=''):
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    return GeoPoint(lat, lng, label or '') if is_in_vietnam(lat, lng) else None


class DisabledProvider:
    name = 'disabled'

    def geocode(self, text):
        raise GeocodingDisabled()

    def autocomplete(self, text, focus):
        return []

    def place(self, ref):
        raise GeocodingDisabled()


class GeoapifyProvider(_HttpProvider):
    """https://apidocs.geoapify.com/docs/geocoding — Geocoding and Address Autocomplete.

    ``filter=countrycode:vn`` keeps only features OpenStreetMap places in Vietnam.
    Autocomplete items already carry coordinates, so the ref encodes them and
    ``place`` resolves without a second billed request.
    """

    name = 'geoapify'
    base_url = 'https://api.geoapify.com/v1/geocode'

    def _params(self, text, **extra):
        return {
            'text': text,
            'apiKey': settings.GEOCODING_API_KEY,
            'filter': 'countrycode:vn',
            'lang': 'vi',
            'format': 'json',
            **extra,
        }

    def geocode(self, text):
        results = (self._get(f'{self.base_url}/search', self._params(text, limit=1)) or {}).get(
            'results'
        ) or []
        if not results:
            return None
        return _point(results[0].get('lat'), results[0].get('lon'), results[0].get('formatted'))

    def autocomplete(self, text, focus):
        params = self._params(text, limit=AUTOCOMPLETE_LIMIT)
        if focus:
            params['bias'] = f'proximity:{focus[1]},{focus[0]}'
        data = self._get(f'{self.base_url}/autocomplete', params)
        suggestions = []
        for item in (data or {}).get('results') or []:
            point = _point(item.get('lat'), item.get('lon'))
            if point is None:
                continue
            suggestions.append(
                PlaceSuggestion(
                    ref=f'{self.name}:{point.latitude:.6f},{point.longitude:.6f}',
                    label=item.get('address_line1') or item.get('formatted', ''),
                    secondary=item.get('address_line2', ''),
                )
            )
        return suggestions[:AUTOCOMPLETE_LIMIT]

    def place(self, ref):
        lat, _, lng = ref.removeprefix(f'{self.name}:').partition(',')
        return _point(lat, lng)


class NominatimProvider(_HttpProvider):
    """Development only. The OSM usage policy forbids autocomplete and allows at
    most one request per second, so autocomplete returns nothing here."""

    name = 'nominatim'
    base_url = 'https://nominatim.openstreetmap.org'
    _lock = threading.Lock()
    _last_call = 0.0

    def _throttled_get(self, url, params):
        with self._lock:
            wait = 1.0 - (time.monotonic() - NominatimProvider._last_call)
            if wait > 0:
                time.sleep(wait)
            NominatimProvider._last_call = time.monotonic()
        return self._get(url, params)

    def geocode(self, text):
        results = self._throttled_get(
            f'{self.base_url}/search',
            {'q': text, 'format': 'jsonv2', 'countrycodes': 'vn', 'limit': 1},
        )
        if not isinstance(results, list) or not results:
            return None
        return _point(results[0].get('lat'), results[0].get('lon'), results[0].get('display_name'))

    def autocomplete(self, text, focus):
        return []

    def place(self, ref):
        return None


_PROVIDERS = {
    'disabled': DisabledProvider,
    'geoapify': GeoapifyProvider,
    'nominatim': NominatimProvider,
}


def get_geocoding_provider() -> GeocodingProvider:
    name = settings.GEOCODING_PROVIDER
    if name not in _PROVIDERS:
        logger.error('Unknown GEOCODING_PROVIDER %r, geocoding disabled', name)
        name = 'disabled'
    if name == 'geoapify' and not settings.GEOCODING_API_KEY:
        name = 'disabled'
    return _PROVIDERS[name]()


def _cached(key):
    entry = GeocodeCache.objects.filter(query_key=key, expires_at__gt=timezone.now()).first()
    if entry is None:
        return None, False
    if entry.status == GeocodeCache.Status.FOUND:
        return GeoPoint(entry.latitude, entry.longitude, entry.label), True
    return None, True


def _store(key, point, provider_name):
    now = timezone.now()
    GeocodeCache.objects.update_or_create(
        query_key=key,
        defaults={
            'status': GeocodeCache.Status.FOUND if point else GeocodeCache.Status.NOT_FOUND,
            'latitude': point.latitude if point else None,
            'longitude': point.longitude if point else None,
            'label': (point.label if point else '')[:500],
            'provider': provider_name,
            'expires_at': now + (FOUND_TTL if point else NOT_FOUND_TTL),
        },
    )


def cached_geocode(key):
    """Cache-only lookup: (point, hit). Never calls the provider."""
    return _cached(normalize_geocode_key(key))


def geocode_address(text, *, provider=None):
    """Point for a full address string, via cache then provider.

    Raises ``GeocodingUnavailable``/``GeocodingDisabled`` so callers (Celery task)
    can retry or fall back; a definite "not found" is cached and returns None."""
    key = normalize_geocode_key(text)
    point, hit = _cached(key)
    if hit:
        return point
    provider = provider or get_geocoding_provider()
    point = provider.geocode(text)
    _store(key, point, provider.name)
    return point


AUTOCOMPLETE_CACHE_SECONDS = 24 * 3600


def autocomplete_places(text, focus=None, *, provider=None):
    """Provider suggestions, cached a day per (text, focus rounded to ~1 km)."""
    provider = provider or get_geocoding_provider()
    if provider.name == 'disabled':
        return []
    focus_key = f'{focus[0]:.2f},{focus[1]:.2f}' if focus else '-'
    key = f'geo:ac:{provider.name}:{focus_key}:{normalize_geocode_key(text)}'
    cached = cache.get(key)
    if cached is not None:
        return [PlaceSuggestion(*item) for item in cached]
    try:
        suggestions = provider.autocomplete(text, focus)
    except GeocodingError as error:
        logger.info('Geocoding autocomplete failed: %s', error.reason_code)
        return []
    cache.set(key, [(s.ref, s.label, s.secondary) for s in suggestions], AUTOCOMPLETE_CACHE_SECONDS)
    return suggestions


def resolve_place(ref, *, provider=None):
    """Point for a suggestion ref from ``autocomplete_places`` (cached); None when the
    provider is down or the ref belongs to another provider (request path: no raise)."""
    key = normalize_geocode_key('place', ref)
    point, hit = _cached(key)
    if hit:
        return point
    provider = provider or get_geocoding_provider()
    if not ref.startswith(f'{provider.name}:'):
        return None
    try:
        point = provider.place(ref)
    except GeocodingError as error:
        logger.info('Geocoding place lookup failed: %s', error.reason_code)
        return None
    _store(key, point, provider.name)
    return point
