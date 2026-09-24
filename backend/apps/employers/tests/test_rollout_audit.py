import io
import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import User

from ..models import PhoneOtp

STRICT_SETTINGS = {
    'UPLOAD_QUARANTINE_ENABLED': True,
    'EMPLOYER_UPLOAD_SESSION_REQUIRED': True,
    'CANDIDATE_UPLOAD_SESSION_REQUIRED': True,
    'UPLOAD_SESSION_ALLOWED_PURPOSES': (
        'employer_verification',
        'employer_company_update',
        'candidate_cv',
    ),
    'EMPLOYER_SMS_OTP_ENABLED': True,
    'EMPLOYER_SMS_PROVIDER': 'fake',
    'EMPLOYER_DPA_POLICY_VERSION': 'test-v1',
    'EMPLOYER_DPA_DOCUMENT_SHA256': 'a' * 64,
    'EMPLOYER_DPA_DOCUMENT_URL': 'https://example.test/dpa/test-v1',
    'EMPLOYER_EVENT_RETENTION_DAYS': 730,
}


@override_settings(**STRICT_SETTINGS)
class EmployerRolloutAuditCommandTests(TestCase):
    @patch(
        'apps.employers.management.commands.audit_employer_workflow_rollout.upload_scanner_readiness',
        return_value=SimpleNamespace(ready=True, code='ready'),
    )
    def test_strict_report_is_pii_free_and_ready(self, readiness):
        output = io.StringIO()

        call_command(
            'audit_employer_workflow_rollout',
            '--strict',
            '--probe-scanner',
            '--json',
            stdout=output,
        )

        report = json.loads(output.getvalue())
        self.assertTrue(report['ready'])
        self.assertEqual(report['blockers'], [])
        self.assertTrue(report['configuration']['scanner']['ready'])
        self.assertNotIn('email', report['counters'])
        readiness.assert_called_once_with()

    @patch(
        'apps.employers.management.commands.audit_employer_workflow_rollout.upload_scanner_readiness',
        return_value=SimpleNamespace(ready=True, code='ready'),
    )
    def test_strict_report_fails_closed_for_active_legacy_phone_challenge(self, readiness):
        employer = User.objects.create_user(
            email='rollout-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        PhoneOtp.objects.create(
            user=employer,
            purpose=PhoneOtp.Purpose.LEGACY_EMAIL,
            dispatch_status=PhoneOtp.DispatchStatus.LEGACY_EMAIL,
            phone='0900000000',
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        output = io.StringIO()

        with self.assertRaises(CommandError):
            call_command(
                'audit_employer_workflow_rollout',
                '--strict',
                '--probe-scanner',
                '--json',
                stdout=output,
            )

        report = json.loads(output.getvalue().splitlines()[0])
        self.assertFalse(report['ready'])
        self.assertIn('active_legacy_phone_challenges', report['blockers'])
        self.assertNotIn('0900000000', output.getvalue())
