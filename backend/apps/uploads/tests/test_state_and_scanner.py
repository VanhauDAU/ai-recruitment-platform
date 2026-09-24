from io import BytesIO
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.uploads.configuration import (
    CLAMAV_BACKEND,
    upload_scanning_configuration_errors,
)
from apps.uploads.models import (
    UploadState,
    UploadStateError,
    UploadTrustStatus,
    ensure_upload_transition,
    upload_trust_is_attachable,
)
from apps.uploads.services.scanners import (
    ClamAVStreamScanner,
    ScannerProtocolError,
    ScannerVerdict,
    parse_clamd_scan_response,
    upload_scanner_readiness,
)
from apps.uploads.tests.fakes import FakeUploadScanner, TimeoutUploadScanner


class UploadStateInvariantTests(SimpleTestCase):
    def test_canonical_state_graph_rejects_bypassing_scan(self):
        ensure_upload_transition(UploadState.UPLOADING, UploadState.QUARANTINED)
        ensure_upload_transition(UploadState.QUARANTINED, UploadState.SCANNING)
        ensure_upload_transition(UploadState.SCANNING, UploadState.CLEAN)

        with self.assertRaises(UploadStateError):
            ensure_upload_transition(UploadState.UPLOADING, UploadState.CLEAN)
        with self.assertRaises(UploadStateError):
            ensure_upload_transition(UploadState.ERROR, UploadState.CLEAN)

    def test_legacy_is_attachable_but_is_never_relabelled_clean(self):
        self.assertTrue(upload_trust_is_attachable(UploadTrustStatus.CLEAN))
        self.assertTrue(upload_trust_is_attachable(UploadTrustStatus.LEGACY_TRUSTED))
        self.assertNotEqual(UploadTrustStatus.LEGACY_TRUSTED, UploadTrustStatus.CLEAN)


class ScannerAdapterTests(SimpleTestCase):
    def test_clamd_parser_accepts_only_documented_clean_or_found_outcomes(self):
        clean = parse_clamd_scan_response(b'stream: OK\x00')
        malicious = parse_clamd_scan_response(b'stream: Eicar-Test-Signature FOUND\x00')

        self.assertEqual(clean.verdict, ScannerVerdict.CLEAN)
        self.assertEqual(malicious.verdict, ScannerVerdict.MALICIOUS)
        self.assertEqual(malicious.signature, 'Eicar-Test-Signature')
        with self.assertRaises(ScannerProtocolError):
            parse_clamd_scan_response(b'stream: UNKNOWN\x00')

    @override_settings(UPLOAD_MAX_BYTES=4)
    def test_clamav_adapter_refuses_stream_over_configured_cap_before_verdict(self):
        class FakeConnection:
            def __init__(self):
                self.sent = bytearray()

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def sendall(self, payload):
                self.sent.extend(payload)

        scanner = ClamAVStreamScanner(host='127.0.0.1', port=3310, max_bytes=4)
        connection = FakeConnection()

        with (
            patch.object(scanner, '_connect', return_value=connection),
            self.assertRaises(ScannerProtocolError),
        ):
            scanner.scan(BytesIO(b'12345'))

        self.assertTrue(connection.sent.startswith(b'zINSTREAM\x00'))

    def test_readiness_is_machine_readable_and_redacted(self):
        ready = upload_scanner_readiness(scanner=FakeUploadScanner())
        unavailable = upload_scanner_readiness(scanner=TimeoutUploadScanner())

        self.assertTrue(ready.ready)
        self.assertEqual(ready.code, 'ready')
        self.assertFalse(unavailable.ready)
        self.assertEqual(unavailable.code, 'scanner_timeout')
        self.assertFalse(hasattr(ready, 'endpoint'))


class UploadScannerConfigurationTests(SimpleTestCase):
    def test_disabled_pipeline_has_no_startup_requirement(self):
        self.assertEqual(
            upload_scanning_configuration_errors(
                enabled=False,
                backend='',
                allowed_purposes=(),
                clamav_host='',
                clamav_port=0,
                max_bytes=0,
                owner_max_active_sessions=0,
                owner_max_active_bytes=0,
                docx_max_entries=0,
                docx_max_uncompressed_bytes=0,
                docx_max_compression_ratio=0,
                spool_memory_bytes=0,
                session_ttl_seconds=0,
                write_lease_seconds=0,
                scan_lease_seconds=0,
                scan_max_attempts=0,
                scan_retry_base_seconds=0,
                clean_retention_days=0,
                evidence_retention_days=0,
                cleanup_batch_size=0,
                clamav_connect_timeout_seconds=0,
                clamav_read_timeout_seconds=0,
                clamav_stream_chunk_bytes=0,
                production=True,
            ),
            [],
        )

    def test_enabled_production_pipeline_rejects_fake_and_missing_clamav(self):
        fake_errors = upload_scanning_configuration_errors(
            enabled=True,
            backend='apps.uploads.tests.fakes.FakeUploadScanner',
            allowed_purposes=('candidate_cv',),
            clamav_host='',
            clamav_port=3310,
            max_bytes=1,
            owner_max_active_sessions=1,
            owner_max_active_bytes=1,
            docx_max_entries=1,
            docx_max_uncompressed_bytes=1,
            docx_max_compression_ratio=2,
            spool_memory_bytes=1,
            session_ttl_seconds=1,
            write_lease_seconds=1,
            scan_lease_seconds=1,
            scan_max_attempts=1,
            scan_retry_base_seconds=1,
            clean_retention_days=730,
            evidence_retention_days=1,
            cleanup_batch_size=1,
            clamav_connect_timeout_seconds=1,
            clamav_read_timeout_seconds=1,
            clamav_stream_chunk_bytes=1,
            production=True,
        )
        clamav_errors = upload_scanning_configuration_errors(
            enabled=True,
            backend=CLAMAV_BACKEND,
            allowed_purposes=('candidate_cv',),
            clamav_host='',
            clamav_port=3310,
            max_bytes=1,
            owner_max_active_sessions=1,
            owner_max_active_bytes=1,
            docx_max_entries=1,
            docx_max_uncompressed_bytes=1,
            docx_max_compression_ratio=2,
            spool_memory_bytes=1,
            session_ttl_seconds=1,
            write_lease_seconds=1,
            scan_lease_seconds=1,
            scan_max_attempts=1,
            scan_retry_base_seconds=1,
            clean_retention_days=730,
            evidence_retention_days=1,
            cleanup_batch_size=1,
            clamav_connect_timeout_seconds=1,
            clamav_read_timeout_seconds=1,
            clamav_stream_chunk_bytes=1,
            production=True,
        )

        self.assertTrue(any('fake/test' in error for error in fake_errors))
        self.assertTrue(any('CLAMAV_HOST' in error for error in clamav_errors))

    def test_enabled_pipeline_rejects_unmapped_purpose_and_unsafe_owner_quota(self):
        errors = upload_scanning_configuration_errors(
            enabled=True,
            backend=CLAMAV_BACKEND,
            allowed_purposes=('unmapped_business_domain',),
            clamav_host='clamav',
            clamav_port=3310,
            max_bytes=100,
            owner_max_active_sessions=0,
            owner_max_active_bytes=99,
            docx_max_entries=1,
            docx_max_uncompressed_bytes=1,
            docx_max_compression_ratio=2,
            spool_memory_bytes=1,
            session_ttl_seconds=1,
            write_lease_seconds=1,
            scan_lease_seconds=1,
            scan_max_attempts=1,
            scan_retry_base_seconds=1,
            clean_retention_days=730,
            evidence_retention_days=1,
            cleanup_batch_size=1,
            clamav_connect_timeout_seconds=1,
            clamav_read_timeout_seconds=1,
            clamav_stream_chunk_bytes=1,
        )

        self.assertTrue(any('role capability' in error for error in errors))
        self.assertTrue(any('MAX_ACTIVE_SESSIONS' in error for error in errors))
        self.assertTrue(any('MAX_ACTIVE_BYTES' in error for error in errors))
