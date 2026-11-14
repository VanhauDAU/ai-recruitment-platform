"""A new application reaches the recruiter: bell notice and email."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone

from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.services import create_v2_cv
from apps.employers.models import Company, EmployerNotification, EmployerNotificationPreference
from apps.jobs.models import Job, JobApplicationContact, JobApplicationEmail
from apps.sitecontent.models import SiteSetting

from ..models import Application
from ..services import create_application_record


class NewApplicationAlertTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='alert-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        self.employer = users.create_user(
            email='alert-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Alert Co', created_by=self.employer)
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='QA Engineer',
            description='d',
            status=Job.Status.ACTIVE,
        )
        template, _version = make_published_template('Alert template')
        self.cv = create_v2_cv(actor=self.candidate, title='Alert CV', template=template)
        fill_cv_for_application(self.cv, self.candidate, full_name='Bí Mật Tên')

    def apply(self):
        with self.captureOnCommitCallbacks(execute=True):
            return create_application_record(candidate=self.candidate, job=self.job, cv=self.cv)

    def test_job_contacts_get_an_email_without_the_candidate_name(self):
        contact = JobApplicationContact.objects.create(
            job=self.job, recipient_name='HR', phone='0909'
        )
        JobApplicationEmail.objects.create(contact=contact, email='hr@alert.example')
        JobApplicationEmail.objects.create(
            contact=contact, email='lead@alert.example', sort_order=1
        )

        application = self.apply()

        self.assertEqual(
            sorted(message.to[0] for message in mail.outbox),
            ['hr@alert.example', 'lead@alert.example'],
        )
        body = mail.outbox[0].alternatives[0][0]
        self.assertIn('QA Engineer', mail.outbox[0].subject)
        self.assertIn(application.public_id, body)
        self.assertNotIn('Bí Mật Tên', body)
        notice = EmployerNotification.objects.get(
            recipient=self.employer, event_type=EmployerNotification.EventType.APPLICATION_RECEIVED
        )
        self.assertIn(f'application={application.public_id}', notice.action_path)

    def test_poster_is_the_fallback_recipient(self):
        self.apply()

        self.assertEqual([message.to[0] for message in mail.outbox], [self.employer.email])

    def test_preference_and_site_switch_stop_the_email_but_keep_the_bell(self):
        EmployerNotificationPreference.objects.create(
            recipient=self.employer, new_application_email=False
        )
        self.apply()
        self.assertEqual(mail.outbox, [])

        EmployerNotificationPreference.objects.update(new_application_email=True)
        SiteSetting.objects.create(key='email_notify_new_application', value=False)
        self.apply_again()
        self.assertEqual(mail.outbox, [])
        self.assertEqual(
            EmployerNotification.objects.filter(
                event_type=EmployerNotification.EventType.APPLICATION_RECEIVED
            ).count(),
            2,
        )

    def apply_again(self):
        # The five-minute re-apply cooldown is not under test here.
        Application.objects.update(applied_at=timezone.now() - timedelta(minutes=10))
        self.apply()
