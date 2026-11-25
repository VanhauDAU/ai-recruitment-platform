from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import AuthSession
from apps.accounts.services import issue_tokens

from ..services import identity_is_authorized, redeem_ticket

User = get_user_model()


class RealtimeTicketTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='socket@example.com', password='Password@123', role=User.Role.EMPLOYER
        )

    def ticket(self):
        tokens = issue_tokens(self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        response = self.client.post(reverse('realtime-ticket'))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['expires_in'], 30)
        return response.data['ticket']

    def test_anonymous_cannot_get_a_ticket(self):
        self.assertEqual(self.client.post(reverse('realtime-ticket')).status_code, 401)

    def test_ticket_is_bound_to_the_session_and_consumed_once(self):
        ticket = self.ticket()

        identity = redeem_ticket(ticket)

        self.assertEqual(identity.user_id, self.user.pk)
        self.assertEqual(identity.sid, str(AuthSession.objects.get(user=self.user).id))
        self.assertIsNone(redeem_ticket(ticket))

    def test_only_admin_accounts_join_the_admin_group(self):
        self.assertFalse(redeem_ticket(self.ticket()).is_admin)

        self.user.role = User.Role.ADMIN
        self.user.save(update_fields=['role'])
        self.assertTrue(redeem_ticket(self.ticket()).is_admin)

    def test_role_change_closes_open_sockets(self):
        identity = redeem_ticket(self.ticket())
        User.objects.filter(pk=self.user.pk).update(role=User.Role.ADMIN)

        self.assertFalse(identity_is_authorized(identity))

    def test_unknown_or_oversized_tickets_are_refused(self):
        self.assertIsNone(redeem_ticket(''))
        self.assertIsNone(redeem_ticket('nope'))
        self.assertIsNone(redeem_ticket('x' * 500))

    def test_revoked_session_cannot_open_a_socket(self):
        ticket = self.ticket()
        AuthSession.objects.filter(user=self.user).update(revoked_at=timezone.now())

        self.assertIsNone(redeem_ticket(ticket))

    def test_restricted_account_cannot_open_a_socket(self):
        ticket = self.ticket()
        User.objects.filter(pk=self.user.pk).update(status=User.Status.BANNED)

        self.assertIsNone(redeem_ticket(ticket))

    def test_password_change_closes_open_sockets(self):
        identity = redeem_ticket(self.ticket())
        User.objects.filter(pk=self.user.pk).update(auth_revision=self.user.auth_revision + 1)

        self.assertFalse(identity_is_authorized(identity))

    def test_an_open_socket_does_not_keep_an_idle_session_alive(self):
        identity = redeem_ticket(self.ticket())
        session = AuthSession.objects.get(user=self.user)
        AuthSession.objects.filter(pk=session.pk).update(
            last_seen_at=timezone.now() - timedelta(minutes=61)
        )

        self.assertFalse(identity_is_authorized(identity))
        session.refresh_from_db()
        # The check is read-only: it neither revokes nor refreshes the session.
        self.assertIsNone(session.revoked_at)
        self.assertLess(session.last_seen_at, timezone.now() - timedelta(minutes=60))
