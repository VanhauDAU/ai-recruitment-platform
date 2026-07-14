from types import SimpleNamespace
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.cvs.models import CvVersion, UserCv
from apps.cvs.services import create_initial_document

from .models import Application
from .services import InvalidApplicationStatusTransition, create_application, update_application_status


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


class ApplicationSnapshotServiceTests(TestCase):
    def test_create_application_uses_a_new_immutable_snapshot(self):
        candidate = get_user_model().objects.create_user(
            email='application-snapshot@example.com', password='password', role='candidate',
        )
        cv = UserCv.objects.create(
            user=candidate, cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER, title='Applied CV',
        )
        initial = create_initial_document(cv, candidate)
        serializer = Mock()
        serializer.validated_data = {'cv': cv}
        serializer.save.return_value = SimpleNamespace()

        create_application(serializer, candidate)

        snapshot = CvVersion.objects.get(version_kind=CvVersion.VersionKind.APPLICATION_SNAPSHOT)
        self.assertEqual(snapshot.parent_version_id, initial.id)
        self.assertEqual(serializer.save.call_args.kwargs['submitted_cv_version'], snapshot)
        self.assertEqual(serializer.save.call_args.kwargs['submitted_cv_title'], 'Applied CV')
