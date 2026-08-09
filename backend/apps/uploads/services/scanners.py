"""Provider-neutral scanner contract and a fail-closed ClamAV adapter."""

from __future__ import annotations

import socket
import struct
from dataclasses import dataclass
from enum import StrEnum
from time import monotonic
from typing import BinaryIO, Protocol

from django.conf import settings
from django.utils.module_loading import import_string

from common.metrics import record_metric


class ScannerVerdict(StrEnum):
    CLEAN = 'clean'
    MALICIOUS = 'malicious'


@dataclass(frozen=True)
class ScannerResult:
    verdict: ScannerVerdict
    signature: str = ''
    revision: str = ''


@dataclass(frozen=True)
class ScannerReadiness:
    ready: bool
    code: str
    latency_ms: int


class UploadScanner(Protocol):
    def scan(self, stream: BinaryIO) -> ScannerResult: ...

    def ping(self) -> bool: ...


class ScannerError(RuntimeError):
    code = 'scanner_error'


class ScannerUnavailable(ScannerError):
    code = 'scanner_unavailable'


class ScannerTimeout(ScannerError):
    code = 'scanner_timeout'


class ScannerProtocolError(ScannerError):
    code = 'scanner_protocol_error'


def _safe_text(payload: bytes) -> str:
    try:
        return payload.rstrip(b'\x00\r\n').decode('utf-8', errors='strict')
    except UnicodeDecodeError as exc:
        raise ScannerProtocolError from exc


def parse_clamd_scan_response(payload: bytes) -> ScannerResult:
    """Parse only ClamAV's documented OK/FOUND outcomes; unknown replies fail closed."""
    response = _safe_text(payload)
    if response.endswith(': OK'):
        return ScannerResult(verdict=ScannerVerdict.CLEAN)
    if response.endswith(' FOUND') and ': ' in response:
        signature = response.rsplit(': ', 1)[1].removesuffix(' FOUND').strip()
        if signature:
            return ScannerResult(verdict=ScannerVerdict.MALICIOUS, signature=signature[:255])
    raise ScannerProtocolError


class ClamAVStreamScanner:
    """Small stdlib implementation of clamd's length-prefixed INSTREAM protocol."""

    def __init__(
        self,
        *,
        host=None,
        port=None,
        connect_timeout=None,
        read_timeout=None,
        chunk_size=None,
        max_bytes=None,
    ):
        self.host = host if host is not None else settings.CLAMAV_HOST
        self.port = int(port if port is not None else settings.CLAMAV_PORT)
        self.connect_timeout = float(
            connect_timeout
            if connect_timeout is not None
            else settings.CLAMAV_CONNECT_TIMEOUT_SECONDS
        )
        self.read_timeout = float(
            read_timeout if read_timeout is not None else settings.CLAMAV_READ_TIMEOUT_SECONDS
        )
        self.chunk_size = int(
            chunk_size if chunk_size is not None else settings.CLAMAV_STREAM_CHUNK_BYTES
        )
        self.max_bytes = int(max_bytes if max_bytes is not None else settings.UPLOAD_MAX_BYTES)

    def _connect(self):
        try:
            connection = socket.create_connection(
                (self.host, self.port),
                timeout=self.connect_timeout,
            )
            connection.settimeout(self.read_timeout)
            return connection
        except TimeoutError as exc:
            raise ScannerTimeout from exc
        except OSError as exc:
            raise ScannerUnavailable from exc

    @staticmethod
    def _receive(connection, *, limit=4096):
        response = bytearray()
        while len(response) < limit:
            try:
                chunk = connection.recv(min(1024, limit - len(response)))
            except TimeoutError as exc:
                raise ScannerTimeout from exc
            except OSError as exc:
                raise ScannerUnavailable from exc
            if not chunk:
                break
            response.extend(chunk)
            if b'\x00' in chunk or b'\n' in chunk:
                break
        if not response or len(response) >= limit:
            raise ScannerProtocolError
        return bytes(response)

    def ping(self) -> bool:
        with self._connect() as connection:
            try:
                connection.sendall(b'zPING\x00')
            except TimeoutError as exc:
                raise ScannerTimeout from exc
            except OSError as exc:
                raise ScannerUnavailable from exc
            return _safe_text(self._receive(connection)) == 'PONG'

    def scan(self, stream: BinaryIO) -> ScannerResult:
        sent = 0
        with self._connect() as connection:
            try:
                connection.sendall(b'zINSTREAM\x00')
                while True:
                    chunk = stream.read(self.chunk_size)
                    if not chunk:
                        break
                    sent += len(chunk)
                    if sent > self.max_bytes:
                        raise ScannerProtocolError
                    connection.sendall(struct.pack('!I', len(chunk)))
                    connection.sendall(chunk)
                connection.sendall(struct.pack('!I', 0))
            except TimeoutError as exc:
                raise ScannerTimeout from exc
            except OSError as exc:
                raise ScannerUnavailable from exc
            return parse_clamd_scan_response(self._receive(connection))


def get_upload_scanner() -> UploadScanner:
    scanner_class = import_string(settings.UPLOAD_SCANNER_BACKEND)
    return scanner_class()


def upload_scanner_readiness(*, scanner=None) -> ScannerReadiness:
    """Return a machine-readable live probe without provider/version/endpoint details."""
    started = monotonic()
    try:
        ready = bool((scanner or get_upload_scanner()).ping())
        code = 'ready' if ready else 'unexpected_response'
    except ScannerError as exc:
        ready = False
        code = exc.code
    except Exception:  # noqa: BLE001 - configuration/import failures also fail closed
        ready = False
        code = 'scanner_configuration_error'
    latency_ms = max(0, round((monotonic() - started) * 1000))
    record_metric(
        'upload_scanner_readiness',
        latency_ms,
        status='ready' if ready else 'failed',
        failure_code='' if ready else code,
    )
    return ScannerReadiness(ready=ready, code=code, latency_ms=latency_ms)
