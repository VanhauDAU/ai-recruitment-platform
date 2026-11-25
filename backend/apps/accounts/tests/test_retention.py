from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.employers.models import EmployerDpaAcceptance, RecruiterProfile

from ..models import AuthEmailJob, AuthSession, User
from ..tasks import maintenance


def _session(user, jti, *, expires_in_days, revoked_days_ago=None):
    now = timezone.now()
    return AuthSession.objects.create(
        user=user,
        portal=user.role,
        refresh_jti=jti,
        expires_at=now + timedelta(days=expires_in_days),
        revoked_at=None if revoked_days_ago is None else now - timedelta(days=revoked_days_ago),
    )


@override_settings(AUTH_SESSION_RETENTION_DAYS=90, AUTH_EMAIL_JOB_RETENTION_DAYS=30)
class AuthRetentionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='retention@example.com', password='Pw@12345')

    def test_purges_only_sessions_ended_before_the_retention_window(self):
        live = _session(self.user, 'live', expires_in_days=5)
        recently_revoked = _session(self.user, 'recent', expires_in_days=5, revoked_days_ago=10)
        _session(self.user, 'old-revoked', expires_in_days=5, revoked_days_ago=100)
        _session(self.user, 'old-expired', expires_in_days=-100)

        self.assertEqual(maintenance.purge_ended_auth_sessions(), 2)
        self.assertEqual(
            set(AuthSession.objects.values_list('pk', flat=True)),
            {live.pk, recently_revoked.pk},
        )

    def test_keeps_sessions_referenced_by_dpa_evidence(self):
        employer = User.objects.create_user(
            email='retention-dpa@example.com', password='Pw@12345', role=User.Role.EMPLOYER
        )
        recruiter = RecruiterProfile.objects.create(user=employer)
        session = _session(employer, 'dpa', expires_in_days=-200)
        EmployerDpaAcceptance.objects.create(
            recruiter=recruiter,
            policy_version='v1',
            document_sha256='a' * 64,
            document_url='https://example.test/dpa',
            auth_session=session,
        )

        self.assertEqual(maintenance.purge_ended_auth_sessions(), 0)
        self.assertTrue(AuthSession.objects.filter(pk=session.pk).exists())

    def test_purges_finished_email_jobs_but_keeps_pending_and_welcome(self):
        old = timezone.now() - timedelta(days=40)
        kinds = AuthEmailJob.Kind
        sent = AuthEmailJob.objects.create(
            user=self.user, kind=kinds.VERIFICATION, status=AuthEmailJob.Status.SENT
        )
        failed = AuthEmailJob.objects.create(
            user=self.user, kind=kinds.PASSWORD_RESET, status=AuthEmailJob.Status.FAILED
        )
        pending = AuthEmailJob.objects.create(
            user=self.user, kind=kinds.PASSWORD_RESET, status=AuthEmailJob.Status.PENDING
        )
        welcome = AuthEmailJob.objects.create(
            user=self.user, kind=kinds.WELCOME, status=AuthEmailJob.Status.SENT
        )
        fresh = AuthEmailJob.objects.create(
            user=self.user, kind=kinds.VERIFICATION, status=AuthEmailJob.Status.SENT
        )
        AuthEmailJob.objects.filter(pk__in=[sent.pk, failed.pk, pending.pk, welcome.pk]).update(
            updated_at=old
        )

        self.assertEqual(maintenance.purge_finished_auth_email_jobs(), 2)
        self.assertEqual(
            set(AuthEmailJob.objects.values_list('pk', flat=True)),
            {pending.pk, welcome.pk, fresh.pk},
        )

    def test_flushes_expired_outstanding_jwt(self):
        now = timezone.now()
        OutstandingToken.objects.create(
            user=self.user, jti='expired', token='x', expires_at=now - timedelta(days=1)
        )
        OutstandingToken.objects.create(
            user=self.user, jti='valid', token='y', expires_at=now + timedelta(days=1)
        )

        maintenance.flush_expired_jwt_tokens()
        maintenance.clear_expired_django_sessions()

        self.assertEqual(list(OutstandingToken.objects.values_list('jti', flat=True)), ['valid'])
