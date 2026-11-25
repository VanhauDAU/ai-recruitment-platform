from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from apps.accounts.models import AdminAccessAuditLog, User

from ..models import EmployerPhoneVerificationEvent, PhoneOtp
from .factories import make_recruiter


def run(email, *, phone='0912345678', reason='Gọi xác nhận với chủ tài khoản', **extra):
    out = StringIO()
    call_command(
        'verify_employer_phone',
        email,
        phone=phone,
        reason=reason,
        no_input=True,
        stdout=out,
        **extra,
    )
    return out.getvalue()


@override_settings(EMPLOYER_SMS_OTP_ENABLED=False)
class VerifyEmployerPhoneCommandTests(TestCase):
    def setUp(self):
        self.user, self.recruiter = make_recruiter('ntd@example.com', phone_verified=False)
        self.admin = User.objects.create_user(
            email='admin@example.com', password='Password@123', role=User.Role.ADMIN
        )

    def test_marks_phone_verified_through_the_shared_rule(self):
        output = run('ntd@example.com', actor_email='admin@example.com')

        self.recruiter.refresh_from_db()
        self.user.refresh_from_db()
        self.assertTrue(self.recruiter.has_verified_phone)
        self.assertEqual(self.recruiter.verified_phone, '+84912345678')
        self.assertEqual(self.user.phone, '+84912345678')
        self.assertIn('...678', output)

        event = EmployerPhoneVerificationEvent.objects.get(user=self.user)
        self.assertEqual(event.event_type, EmployerPhoneVerificationEvent.EventType.VERIFIED)
        self.assertEqual(event.purpose, PhoneOtp.Purpose.INITIAL_VERIFICATION)
        self.assertEqual(event.reason_code, 'admin_attested')

        audit = AdminAccessAuditLog.objects.get(action='employer_phone_verified_by_admin')
        self.assertEqual(audit.actor, self.admin)
        self.assertEqual(audit.target_public_id, self.recruiter.public_id)
        self.assertEqual(audit.payload['phone_last3'], '678')
        self.assertNotIn('0912345678', str(audit.payload))

    def test_records_cli_identity_without_actor(self):
        run('ntd@example.com')

        audit = AdminAccessAuditLog.objects.get(action='employer_phone_verified_by_admin')
        self.assertIsNone(audit.actor)
        self.assertTrue(audit.actor_identifier.startswith('cli:'))

    @override_settings(EMPLOYER_SMS_OTP_ENABLED=True)
    def test_refuses_while_sms_is_live(self):
        with self.assertRaisesMessage(CommandError, 'SMS đang bật'):
            run('ntd@example.com')
        self.recruiter.refresh_from_db()
        self.assertIsNone(self.recruiter.phone_verified_at)

    def test_refuses_a_number_another_recruiter_verified(self):
        other_user, other = make_recruiter('khac@example.com')
        with self.assertRaisesMessage(CommandError, 'nhà tuyển dụng khác'):
            run('ntd@example.com', phone=other.verified_phone)
        self.recruiter.refresh_from_db()
        self.assertIsNone(self.recruiter.phone_verified_at)
        self.assertFalse(AdminAccessAuditLog.objects.exists())

    def test_rejects_invalid_number_and_non_employer(self):
        with self.assertRaises(CommandError):
            run('ntd@example.com', phone='12345')
        with self.assertRaisesMessage(CommandError, 'Không tìm thấy tài khoản nhà tuyển dụng'):
            run('admin@example.com')
