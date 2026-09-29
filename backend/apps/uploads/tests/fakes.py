from apps.uploads.services.scanners import (
    ScannerResult,
    ScannerTimeout,
    ScannerUnavailable,
    ScannerVerdict,
)


class FakeUploadScanner:
    """Deterministic test scanner; never selected by non-test settings."""

    def ping(self):
        return True

    def scan(self, stream):
        payload = stream.read()
        if b'EICAR' in payload or b'POLYGLOT-MALWARE' in payload:
            return ScannerResult(
                verdict=ScannerVerdict.MALICIOUS,
                signature='Eicar-Test-Signature',
                revision='fake-definitions-v1',
            )
        return ScannerResult(
            verdict=ScannerVerdict.CLEAN,
            revision='fake-definitions-v1',
        )


class TimeoutUploadScanner:
    def ping(self):
        raise ScannerTimeout

    def scan(self, stream):
        del stream
        raise ScannerTimeout


class UnavailableUploadScanner:
    def ping(self):
        raise ScannerUnavailable

    def scan(self, stream):
        del stream
        raise ScannerUnavailable
