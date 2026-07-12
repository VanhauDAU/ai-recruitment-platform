from types import SimpleNamespace
from unittest.mock import Mock

from django.test import TestCase

from .models import Application
from .services import InvalidApplicationStatusTransition, update_application_status


class ApplicationStatusTransitionServiceTests(TestCase):
    def serializer(self, current_status, next_status=None):
        serializer = Mock()
        serializer.instance = SimpleNamespace(status=current_status)
        serializer.validated_data = {} if next_status is None else {'status': next_status}
        serializer.save.return_value = serializer.instance
        return serializer

    def test_allows_forward_transition_and_records_matching_timestamp(self):
        serializer = self.serializer(Application.Status.SUBMITTED, Application.Status.SHORTLISTED)

        update_application_status(serializer)

        serializer.save.assert_called_once()
        self.assertIn('shortlisted_at', serializer.save.call_args.kwargs)

    def test_rejects_backward_or_reopened_transition(self):
        serializer = self.serializer(Application.Status.ACCEPTED, Application.Status.VIEWED)

        with self.assertRaises(InvalidApplicationStatusTransition):
            update_application_status(serializer)

        serializer.save.assert_not_called()

    def test_note_only_and_idempotent_status_updates_do_not_reset_timestamp(self):
        for next_status in (None, Application.Status.VIEWED):
            with self.subTest(next_status=next_status):
                serializer = self.serializer(Application.Status.VIEWED, next_status)

                update_application_status(serializer)

                serializer.save.assert_called_once_with()
