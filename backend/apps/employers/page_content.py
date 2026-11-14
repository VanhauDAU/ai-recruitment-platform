"""Pure rules for free-form page content: social networks and intro videos.

Like ``page_registry`` this module holds no queries, so the services that
validate a submission and the selectors that render the page share one
definition of which links and videos are allowed.
"""

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator

URL_MAX_LENGTH = 500
HEADLINE_MAX_LENGTH = 160
BENEFIT_LIMIT = 8
OFFICE_LIMIT = 10
# Same cap the media endpoints and the update pipeline enforce.
GALLERY_LIMIT = 10


@dataclass(frozen=True)
class SocialNetwork:
    key: str
    label: str
    placeholder: str
    # Registrable domains; any subdomain (m., vn., www.) is accepted too.
    hosts: tuple


SOCIAL_NETWORKS = (
    SocialNetwork('facebook', 'Facebook', 'https://facebook.com/…', ('facebook.com', 'fb.com')),
    SocialNetwork('linkedin', 'LinkedIn', 'https://linkedin.com/company/…', ('linkedin.com',)),
    SocialNetwork('youtube', 'YouTube', 'https://youtube.com/@…', ('youtube.com', 'youtu.be')),
    SocialNetwork('tiktok', 'TikTok', 'https://tiktok.com/@…', ('tiktok.com',)),
    SocialNetwork('instagram', 'Instagram', 'https://instagram.com/…', ('instagram.com',)),
)
SOCIAL_NETWORKS_BY_KEY = {network.key: network for network in SOCIAL_NETWORKS}

_YOUTUBE_HOSTS = ('youtube.com', 'youtu.be')
_VIMEO_HOSTS = ('vimeo.com',)
_YOUTUBE_ID = re.compile(r'[A-Za-z0-9_-]{11}')
_VIMEO_ID = re.compile(r'[0-9]{1,12}')


def _on_host(hostname, hosts):
    return any(hostname == host or hostname.endswith(f'.{host}') for host in hosts)


def _split_url(value, *, schemes):
    """Parts of a well-formed absolute URL without credentials or a port."""
    if len(value) > URL_MAX_LENGTH:
        return None
    try:
        URLValidator(schemes=list(schemes))(value)
    except DjangoValidationError:
        return None
    parts = urlsplit(value)
    if parts.username or parts.password or parts.port:
        return None
    return parts


def normalize_social_link(network, value):
    """Return the link as stored, or raise ValueError with a reason to show."""
    url = value.strip()
    parts = _split_url(url, schemes=('https',))
    if parts is None or not _on_host((parts.hostname or '').lower(), network.hosts):
        raise ValueError(f'Nhập đường dẫn https tới trang {network.label} của công ty.')
    if parts.path.strip('/') == '':
        raise ValueError(f'Đường dẫn {network.label} phải trỏ tới trang của công ty.')
    return url


def _youtube_id(parts):
    hostname = parts.hostname.lower()
    path = parts.path.strip('/')
    if _on_host(hostname, ('youtu.be',)):
        candidate = path
    elif path == 'watch':
        candidate = (parse_qs(parts.query).get('v') or [''])[0]
    elif path.startswith('shorts/'):
        candidate = path.removeprefix('shorts/')
    else:
        return None
    return candidate if _YOUTUBE_ID.fullmatch(candidate) else None


def parse_video_url(value):
    """``(provider, video_id)`` of a supported intro video URL, else ``None``."""
    parts = _split_url(value.strip(), schemes=('http', 'https'))
    if parts is None:
        return None
    hostname = parts.hostname.lower()
    if _on_host(hostname, _YOUTUBE_HOSTS):
        video_id = _youtube_id(parts)
        return ('youtube', video_id) if video_id else None
    if _on_host(hostname, _VIMEO_HOSTS):
        video_id = parts.path.strip('/')
        return ('vimeo', video_id) if _VIMEO_ID.fullmatch(video_id) else None
    return None


def normalize_video_url(value):
    """Canonical watch URL of a YouTube or Vimeo video; '' clears the video."""
    if not value.strip():
        return ''
    parsed = parse_video_url(value)
    if parsed is None:
        raise ValueError('Chỉ nhận đường dẫn video YouTube hoặc Vimeo.')
    provider, video_id = parsed
    if provider == 'youtube':
        return f'https://www.youtube.com/watch?v={video_id}'
    return f'https://vimeo.com/{video_id}'


def video_embed(value):
    """Click-to-load player data of a stored video URL, or ``None``."""
    parsed = parse_video_url(value) if value else None
    if parsed is None:
        return None
    provider, video_id = parsed
    embed_url = (
        f'https://www.youtube-nocookie.com/embed/{video_id}'
        if provider == 'youtube'
        else f'https://player.vimeo.com/video/{video_id}'
    )
    return {'provider': provider, 'video_id': video_id, 'embed_url': embed_url}
