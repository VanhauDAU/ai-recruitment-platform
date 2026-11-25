"""Tải tệp từ URL do người dùng nhập mà không cho gọi vào mạng nội bộ (SSRF).

Mỗi chặng (kể cả chuyển hướng) phân giải host một lần, đòi mọi địa chỉ đều công
khai rồi nối thẳng tới địa chỉ vừa kiểm, nên đổi DNS giữa chừng không lọt được.
"""

import ipaddress
import socket
from urllib.parse import urljoin, urlsplit

import urllib3

_MAX_REDIRECTS = 3
_TIMEOUT = urllib3.Timeout(connect=5, read=10)
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class RemoteFetchError(Exception):
    """URL không hợp lệ, không công khai hoặc không tải được."""


class RemoteFileTooLarge(RemoteFetchError):
    pass


def _public_address(host, port):
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
    except (OSError, ValueError) as error:
        raise RemoteFetchError('unresolvable host') from error
    if not addresses or not all(a.is_global and not a.is_multicast for a in addresses):
        raise RemoteFetchError('host is not public')
    return str(addresses[0])


def _open(url):
    """Gửi một GET tới đúng địa chỉ đã kiểm; trả về ``(pool, response)``."""
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as error:
        raise RemoteFetchError('invalid url') from error
    host = parts.hostname
    if parts.scheme not in {'http', 'https'} or not host or parts.username:
        raise RemoteFetchError('invalid url')

    secure = parts.scheme == 'https'
    port = port or (443 if secure else 80)
    address = _public_address(host, port)
    if secure:
        pool = urllib3.HTTPSConnectionPool(
            address, port, server_hostname=host, assert_hostname=host
        )
    else:
        pool = urllib3.HTTPConnectionPool(address, port)
    path = parts.path or '/'
    response = pool.urlopen(
        'GET',
        f'{path}?{parts.query}' if parts.query else path,
        headers={'Host': parts.netloc, 'User-Agent': 'Mozilla/5.0 (compatible; MediaImport)'},
        timeout=_TIMEOUT,
        retries=False,
        redirect=False,
        preload_content=False,
    )
    return pool, response


def fetch_public_file(url, *, max_size):
    """Trả về nội dung tại ``url``, dừng ngay khi vượt ``max_size`` byte."""
    try:
        for _ in range(_MAX_REDIRECTS + 1):
            pool, response = _open(url)
            try:
                location = response.headers.get('Location')
                if response.status in _REDIRECT_STATUSES and location:
                    url = urljoin(url, location)
                    continue
                if response.status != 200:
                    raise RemoteFetchError(f'status {response.status}')
                data = bytearray()
                for chunk in response.stream(64 * 1024):
                    data += chunk
                    if len(data) > max_size:
                        raise RemoteFileTooLarge('file too large')
                return bytes(data)
            finally:
                response.close()
                pool.close()
    except (urllib3.exceptions.HTTPError, OSError, UnicodeError) as error:
        raise RemoteFetchError('download failed') from error
    raise RemoteFetchError('too many redirects')
