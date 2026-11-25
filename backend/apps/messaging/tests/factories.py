"""Dựng một tin tuyển dụng có hồ sơ ứng tuyển để thử ProCV Connect."""

from unittest.mock import patch

from django.contrib.auth import get_user_model

from apps.accounts.services import issue_tokens
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.services import create_user_cv
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window
from apps.realtime.tests.test_publish import RecordingLayer

User = get_user_model()


class ConnectFixture:
    """Một NTD có tin, một ứng viên đã nộp hồ sơ, một NTD ngoài cuộc."""

    def setUp(self):
        super().setUp()
        self.layer = RecordingLayer()
        patcher = patch('apps.realtime.services.publish.get_channel_layer', return_value=self.layer)
        patcher.start()
        self.addCleanup(patcher.stop)
        # Test chạy trong một giao dịch: đẩy ngay thay vì chờ commit không bao giờ tới.
        immediate = patch(
            'apps.realtime.services.publish.transaction.on_commit', side_effect=lambda fn: fn()
        )
        immediate.start()
        self.addCleanup(immediate.stop)
        self.recruiter = User.objects.create_user(
            email='connect-hr@example.com', password='x', role='employer', full_name='HR'
        )
        self.company = Company.objects.create(company_name='Connect Co', created_by=self.recruiter)
        make_employer_ready(self.recruiter, company=self.company, candidate_data=True)
        self.outsider = User.objects.create_user(
            email='connect-other@example.com', password='x', role='employer'
        )
        other = Company.objects.create(company_name='Other Co', created_by=self.outsider)
        make_employer_ready(self.outsider, company=other, candidate_data=True)
        self.job = self.make_job('Backend Developer')
        self.candidate = User.objects.create_user(
            email='connect-uv@example.com',
            password='x',
            role='candidate',
            email_verified=True,
            full_name='Nguyễn Văn A',
        )
        template, _version = make_published_template('Connect template')
        self.cv = create_user_cv(actor=self.candidate, title='CV Connect', template=template)
        fill_cv_for_application(self.cv, self.candidate)
        self.application = self.apply(self.candidate, self.job)

    def make_job(self, title, posted_by=None, company=None):
        return Job.objects.create(
            posted_by=posted_by or self.recruiter,
            company=company or self.company,
            title=title,
            description='d',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )

    def apply(self, candidate, job):
        from apps.applications.services import create_application_record

        return create_application_record(candidate=candidate, job=job, cv=self.cv)

    def login(self, user):
        tokens = issue_tokens(user, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def events(self, user):
        group = f'user.{user.pk}'
        return [message['event'] for name, message in self.layer.sent if name == group]
