"""Reporting a company page and the administrator report queue."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import AdminAccessAuditLog, User
from apps.jobs.models import JobReport

from ..models import Company, CompanyPageEvent, CompanyReport, CompanyReportResolutionEvent
from ..page_registry import SECTION_TITLES
from ..services import (
    employer_badge_state_map,
    resolve_company_report,
    reverse_company_report,
    submit_company_report,
)
from .company_page_helpers import (
    add_recruiter,
    hold_company,
    make_candidate,
    make_company,
    make_employer,
    make_limited_admin,
)

REPORT_DETAIL = 'Địa chỉ trụ sở trên trang không đúng với thực tế.'
UPHELD_NOTE = 'Đã đối chiếu: thông tin trên trang sai sự thật.'
REOPEN_NOTE = 'Doanh nghiệp gửi thêm bằng chứng, cần xem lại.'
ROW_KEYS = {
    'public_id',
    'company',
    'reporter_email',
    'reason',
    'reason_label',
    'section_key',
    'section_title',
    'detail',
    'status',
    'resolution_note',
    'resolved_at',
    'resolved_by_email',
    'resolution_history',
    'created_at',
}


class CompanyReportTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.superuser = User.objects.create_superuser(
            email='report-admin@example.com',
            password='Password@123',
        )
        self.creator = make_employer('report-creator@example.com')
        self.company = make_company(
            self.creator,
            name='Công ty TNHH Phần mềm Alpha',
            trade_name='Alpha Tech',
            logo_url='employers/alpha/logo.png',
        )
        self.candidate = make_candidate('report-candidate@example.com')

    def report_url(self, company=None):
        return reverse('company-report-create', args=[(company or self.company).public_id])

    def submit(self, company=None, **body):
        body.setdefault('reason', CompanyReport.Reason.WRONG_INFO)
        return self.client.post(self.report_url(company), body, format='json')

    def make_report(self, *, company=None, reporter=None, **fields):
        fields.setdefault('reason', CompanyReport.Reason.WRONG_INFO)
        return submit_company_report(
            company=company or self.company,
            reporter=reporter or self.candidate,
            **fields,
        )


class CompanyReportCreateApiTests(CompanyReportTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.candidate)

    def test_role_matrix(self):
        cases = [(None, 401), (self.creator, 403), (self.superuser, 403), (self.candidate, 201)]
        for user, expected in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)

                self.assertEqual(self.submit().status_code, expected)

        self.assertEqual(CompanyReport.objects.count(), 1)

    def test_created_report_returns_only_its_id_and_status(self):
        response = self.submit(
            reason=CompanyReport.Reason.IMPERSONATION,
            section_key='about',
            detail=f'  {REPORT_DETAIL}  ',
        )

        self.assertEqual(response.status_code, 201, response.data)
        report = CompanyReport.objects.get()
        self.assertEqual(response.data, {'public_id': report.public_id, 'status': 'pending'})
        self.assertTrue(report.public_id.startswith('crp_'))
        self.assertEqual(
            (report.company, report.reporter, report.reason, report.section_key, report.detail),
            (self.company, self.candidate, 'impersonation', 'about', REPORT_DETAIL),
        )
        self.assertEqual(
            (report.company_name_snapshot, report.trade_name_snapshot),
            ('Công ty TNHH Phần mềm Alpha', 'Alpha Tech'),
        )

    def test_reason_section_and_detail_are_validated(self):
        invalid_payloads = [
            {},
            {'reason': 'fake_company'},
            {'reason': 'wrong_info', 'section_key': 'hero'},
            {'reason': 'wrong_info', 'detail': 'x' * 2001},
            {'reason': 'other'},
            {'reason': 'other', 'detail': '  chín kt   '},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(self.report_url(), payload, format='json')
                self.assertEqual(response.status_code, 400)

        self.assertFalse(CompanyReport.objects.exists())

    def test_every_reason_and_page_section_is_accepted(self):
        reasons = [
            ('wrong_info', 'Thông tin công ty sai sự thật'),
            ('impersonation', 'Mạo danh doanh nghiệp khác'),
            ('inappropriate_content', 'Nội dung hoặc hình ảnh không phù hợp'),
            ('scam', 'Dấu hiệu lừa đảo'),
            ('other', 'Lý do khác'),
        ]
        self.assertEqual(CompanyReport.Reason.choices, reasons)
        section_keys = ['', *SECTION_TITLES]
        self.assertEqual(len(section_keys), 12)

        # More submissions than one account's hourly budget.
        with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'company_report': '100/hour'}):
            for index, section_key in enumerate(section_keys):
                reason = reasons[index % len(reasons)][0]
                company = make_company(self.creator, name=f'Công ty khối {index}')
                with self.subTest(section_key=section_key, reason=reason):
                    response = self.submit(
                        company,
                        reason=reason,
                        section_key=section_key,
                        detail='Đủ mười ký tự.',
                    )
                    self.assertEqual(response.status_code, 201, response.data)

    def test_one_pending_report_per_candidate_and_company(self):
        first = self.submit()
        duplicate = self.submit(reason=CompanyReport.Reason.SCAM)
        self.client.force_authenticate(make_candidate('report-second@example.com'))
        other_candidate = self.submit()
        self.client.force_authenticate(self.candidate)
        other_company = self.submit(make_company(self.creator, name='Công ty Khác'))
        resolve_company_report(
            report=CompanyReport.objects.get(public_id=first.data['public_id']),
            status=CompanyReport.Status.DISMISSED,
            actor=self.superuser,
            note='Thông tin trên trang là đúng.',
        )
        after_resolution = self.submit()

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(
            duplicate.data,
            {'detail': 'Bạn đã có một báo cáo đang chờ xử lý cho công ty này.'},
        )
        for response in (first, other_candidate, other_company, after_resolution):
            self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CompanyReport.objects.count(), 4)

    def test_unknown_and_held_company_answer_the_same_404(self):
        held = make_company(self.creator, name='Công ty Bị Ẩn')
        hold_company(held)

        for url in (reverse('company-report-create', args=['co_unknown']), self.report_url(held)):
            with self.subTest(url=url):
                response = self.client.post(url, {'reason': 'scam'}, format='json')
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data, {'detail': 'Không tìm thấy công ty.'})

        self.assertFalse(CompanyReport.objects.exists())

    def test_reports_are_throttled_per_account(self):
        companies = [
            make_company(self.creator, name=f'Công ty giới hạn {index}') for index in range(3)
        ]
        try:
            with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'company_report': '2/hour'}):
                responses = [self.submit(company) for company in companies]
                self.client.force_authenticate(make_candidate('report-other@example.com'))
                other_account = self.submit()
        finally:
            cache.clear()

        self.assertEqual([response.status_code for response in responses], [201, 201, 429])
        self.assertEqual(other_account.status_code, 201)

    def test_report_never_reaches_the_public_or_the_employer(self):
        owner = add_recruiter(self.company, approved=False)
        report = self.make_report(detail=REPORT_DETAIL)
        self.client.force_authenticate(None)

        detail = self.client.get(reverse('public-company-detail', args=[self.company.slug]))
        self.client.force_authenticate(owner)
        employer_company = self.client.get(reverse('employer-company'))
        admin_queue = self.client.get(reverse('admin-company-report-list'))

        self.assertEqual(employer_company.status_code, 200, employer_company.data)
        self.assertEqual(admin_queue.status_code, 403)
        for response in (detail, employer_company):
            payload = json.dumps(response.data, ensure_ascii=False, default=str)
            for private_value in (self.candidate.email, report.public_id, REPORT_DETAIL):
                with self.subTest(private_value=private_value):
                    self.assertNotIn(private_value, payload)


class AdminCompanyReportApiTests(CompanyReportTestCase):
    def setUp(self):
        super().setUp()
        self.report = self.make_report(section_key='offices', detail=REPORT_DETAIL)
        self.list_url = reverse('admin-company-report-list')
        self.client.force_authenticate(self.superuser)

    def resolve_url(self, report=None):
        return reverse('admin-company-report-resolve', args=[(report or self.report).public_id])

    def reverse_url(self, report=None):
        return reverse('admin-company-report-reverse', args=[(report or self.report).public_id])

    def resolve(self, report=None, **body):
        body = {'status': 'upheld', 'note': UPHELD_NOTE, **body}
        return self.client.post(self.resolve_url(report), body, format='json')

    def reopen(self, report=None, note=REOPEN_NOTE):
        return self.client.post(self.reverse_url(report), {'note': note}, format='json')

    def test_permission_matrix(self):
        cases = [
            # (user, GET list, POST resolve, POST reverse)
            (None, 401, 401, 401),
            (self.creator, 403, 403, 403),
            (self.candidate, 403, 403, 403),
            (make_limited_admin(self.superuser, 'company.view'), 403, 403, 403),
            (make_limited_admin(self.superuser, 'company_report.view'), 200, 403, 403),
            (make_limited_admin(self.superuser, 'company_report.resolve'), 403, 403, 403),
            (
                make_limited_admin(self.superuser, 'company_report.view', 'company_report.resolve'),
                200,
                200,
                200,
            ),
        ]
        for user, expected_list, expected_resolve, expected_reverse in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)

                self.assertEqual(self.client.get(self.list_url).status_code, expected_list)
                self.assertEqual(self.resolve().status_code, expected_resolve)
                self.assertEqual(self.reopen().status_code, expected_reverse)

    def test_row_is_the_job_report_row_with_a_company_object(self):
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(set(response.data), {'count', 'next', 'previous', 'results'})
        self.assertEqual(response.data['count'], 1)
        row = response.data['results'][0]
        self.assertSetEqual(set(row), ROW_KEYS)
        self.assertEqual(
            row['company'],
            {
                'public_id': self.company.public_id,
                'slug': self.company.slug,
                'display_name': 'Alpha Tech',
                'logo_url': 'http://testserver/media/employers/alpha/logo.png',
                'content_policy_hold': False,
            },
        )
        self.assertEqual(
            {key: row[key] for key in ROW_KEYS - {'company', 'created_at'}},
            {
                'public_id': self.report.public_id,
                'reporter_email': 'report-candidate@example.com',
                'reason': 'wrong_info',
                'reason_label': 'Thông tin công ty sai sự thật',
                'section_key': 'offices',
                'section_title': 'Địa điểm',
                'detail': REPORT_DETAIL,
                'status': 'pending',
                'resolution_note': '',
                'resolved_at': None,
                'resolved_by_email': '',
                'resolution_history': [],
            },
        )

    def test_report_about_the_whole_page_has_no_section_title(self):
        self.report.section_key = ''
        self.report.save(update_fields=['section_key'])

        row = self.client.get(self.list_url).data['results'][0]

        self.assertEqual((row['section_key'], row['section_title']), ('', ''))

    def test_row_survives_a_deleted_reporter_account(self):
        self.candidate.delete()

        row = self.client.get(self.list_url).data['results'][0]

        self.assertEqual(row['reporter_email'], '')

    def _second_report(self):
        company = make_company(self.creator, name='Bánh Mì Ánh Dương', trade_name='  ')
        report = self.make_report(
            company=company,
            reporter=make_candidate('aaa-reporter@example.com'),
            reason=CompanyReport.Reason.SCAM,
            detail='AAA yêu cầu ứng viên đóng phí giữ chỗ.',
        )
        resolve_company_report(
            report=report,
            status=CompanyReport.Status.DISMISSED,
            actor=self.superuser,
            note='Không đủ căn cứ.',
        )
        CompanyReport.objects.filter(pk=report.pk).update(
            created_at=timezone.now() - timedelta(days=1)
        )
        return report

    def test_list_filters(self):
        second = self._second_report()
        cases = [
            ({}, [self.report, second]),
            ({'status': 'pending'}, [self.report]),
            ({'status': 'dismissed'}, [second]),
            ({'reason': 'scam'}, [second]),
            ({'company': second.company.public_id}, [second]),
            ({'company': 'co_unknown'}, []),
            ({'q': 'banh mi anh duong'}, [second]),
            ({'q': 'alpha tech'}, [self.report]),
            ({'q': 'AAA-REPORTER'}, [second]),
            ({'q': 'không đủ căn cứ'}, [second]),
            ({'q': self.report.public_id}, [self.report]),
            ({'status': 'pending', 'reason': 'scam'}, []),
            (
                {'status': '', 'reason': '', 'company': '', 'q': '', 'ordering': ''},
                [self.report, second],
            ),
        ]

        for params, expected in cases:
            with self.subTest(params=params):
                response = self.client.get(self.list_url, params)
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(
                    [row['public_id'] for row in response.data['results']],
                    [report.public_id for report in expected],
                )

    def test_ordering_is_a_server_side_whitelist(self):
        second = self._second_report()
        expected_ascending = {
            # "Alpha Tech" < "Bánh Mì Ánh Dương": a blank trade name falls back.
            'company_name': [self.report, second],
            'reason': [second, self.report],
            'detail': [second, self.report],
            'reporter_email': [second, self.report],
            'status': [second, self.report],
            'created_at': [second, self.report],
        }

        for field, expected in expected_ascending.items():
            with self.subTest(field=field):
                ascending = self.client.get(self.list_url, {'ordering': field})
                descending = self.client.get(self.list_url, {'ordering': f'-{field}'})
                self.assertEqual(
                    [row['public_id'] for row in ascending.data['results']],
                    [report.public_id for report in expected],
                )
                self.assertEqual(
                    [row['public_id'] for row in descending.data['results']],
                    [report.public_id for report in reversed(expected)],
                )

        for ordering in ('reporter__password', 'company__tax_code', 'resolved_by', '-id'):
            with self.subTest(ordering=ordering):
                response = self.client.get(self.list_url, {'ordering': ordering})
                self.assertEqual(response.status_code, 400)

    def test_list_validates_filters_and_paginates(self):
        for index in range(21):
            self.make_report(reporter=make_candidate(f'report-page-{index}@example.com'))

        second_page = self.client.get(self.list_url, {'ordering': 'created_at', 'page': 2})
        invalid_status = self.client.get(self.list_url, {'status': 'open'})
        invalid_reason = self.client.get(self.list_url, {'reason': 'fake_company'})

        self.assertEqual(second_page.status_code, 200, second_page.data)
        self.assertEqual((second_page.data['count'], len(second_page.data['results'])), (22, 2))
        self.assertEqual(invalid_status.status_code, 400)
        self.assertEqual(invalid_reason.status_code, 400)

    def test_uphold_records_the_decision_without_touching_the_page(self):
        updated_at = Company.objects.get(pk=self.company.pk).updated_at

        response = self.resolve(note=f'  {UPHELD_NOTE}  ')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(set(response.data), ROW_KEYS)
        self.assertEqual(response.data['status'], 'upheld')
        self.assertEqual(response.data['resolution_note'], UPHELD_NOTE)
        self.assertEqual(response.data['resolved_by_email'], 'report-admin@example.com')
        self.assertIsNotNone(response.data['resolved_at'])
        self.assertIs(response.data['company']['content_policy_hold'], False)
        history = response.data['resolution_history']
        self.assertEqual(len(history), 1)
        self.assertSetEqual(
            set(history[0]),
            {'public_id', 'from_status', 'to_status', 'note', 'actor_email', 'created_at'},
        )
        self.assertTrue(history[0]['public_id'].startswith('crpe_'))
        self.assertEqual(
            (history[0]['from_status'], history[0]['to_status'], history[0]['note']),
            ('pending', 'upheld', UPHELD_NOTE),
        )
        self.assertEqual(history[0]['actor_email'], 'report-admin@example.com')
        company = Company.objects.get(pk=self.company.pk)
        self.assertEqual((company.content_policy_hold, company.updated_at), (False, updated_at))
        self.assertFalse(CompanyPageEvent.objects.exists())
        audit = AdminAccessAuditLog.objects.get(action='resolve_company_report')
        self.assertEqual(
            (audit.actor, audit.target_type, audit.target_public_id),
            (self.superuser, 'company_report', self.report.public_id),
        )
        self.assertEqual(
            audit.payload,
            {'status': 'upheld', 'note': UPHELD_NOTE, 'hold_applied': False},
        )

    def test_dismiss_closes_the_report(self):
        response = self.resolve(status='dismissed', note='Thông tin trên trang là đúng.')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'dismissed')
        self.assertEqual(
            AdminAccessAuditLog.objects.get(action='resolve_company_report').payload['status'],
            'dismissed',
        )

    def test_resolution_input_is_validated(self):
        invalid_payloads = [
            {'status': 'upheld'},
            {'status': 'upheld', 'note': '   '},
            {'status': 'dismissed', 'note': ''},
            {'status': 'upheld', 'note': 'x' * 1001},
            {'status': 'pending', 'note': UPHELD_NOTE},
            {'note': UPHELD_NOTE},
            {'status': 'dismissed', 'note': UPHELD_NOTE, 'apply_hold': True},
            {'status': 'upheld', 'note': UPHELD_NOTE, 'apply_hold': 'có lẽ'},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(self.resolve_url(), payload, format='json')
                self.assertEqual(response.status_code, 400)

        self.report.refresh_from_db()
        self.assertEqual(self.report.status, CompanyReport.Status.PENDING)
        self.assertFalse(CompanyReportResolutionEvent.objects.exists())
        self.assertFalse(AdminAccessAuditLog.objects.filter(action__endswith='_report').exists())
        self.assertIs(Company.objects.get(pk=self.company.pk).content_policy_hold, False)

    def test_resolved_report_cannot_be_resolved_again(self):
        self.resolve()

        second = self.resolve(status='dismissed')
        unknown = self.client.post(
            reverse('admin-company-report-resolve', args=['crp_unknown']),
            {'status': 'upheld', 'note': UPHELD_NOTE},
            format='json',
        )

        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.data, {'detail': 'Báo cáo này đã được xử lý.'})
        self.assertEqual(unknown.status_code, 404)
        self.assertEqual(self.report.resolution_history.count(), 1)

    def test_uphold_can_hold_the_page_in_the_same_decision(self):
        updated_at = Company.objects.get(pk=self.company.pk).updated_at

        response = self.resolve(apply_hold=True)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'upheld')
        self.assertIs(response.data['company']['content_policy_hold'], True)
        company = Company.objects.get(pk=self.company.pk)
        self.assertEqual((company.content_policy_hold, company.updated_at), (True, updated_at))
        event = CompanyPageEvent.objects.get(company=company)
        self.assertEqual(event.event_type, CompanyPageEvent.EventType.POLICY_HOLD_APPLIED)
        self.assertEqual((event.actor, event.payload), (self.superuser, {'reason': UPHELD_NOTE}))
        self.assertEqual(
            AdminAccessAuditLog.objects.get(action='apply_company_page_hold').payload,
            {'reason': UPHELD_NOTE},
        )
        self.assertIs(
            AdminAccessAuditLog.objects.get(action='resolve_company_report').payload[
                'hold_applied'
            ],
            True,
        )
        self.client.force_authenticate(None)
        public = self.client.get(reverse('public-company-detail', args=[company.slug]))
        self.assertEqual(public.status_code, 404)

    def test_hold_is_skipped_silently_when_the_page_is_already_held(self):
        hold_company(self.company)

        response = self.resolve(apply_hold=True)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'upheld')
        self.assertIs(response.data['company']['content_policy_hold'], True)
        self.assertFalse(CompanyPageEvent.objects.exists())
        self.assertFalse(AdminAccessAuditLog.objects.filter(action='apply_company_page_hold'))
        self.assertIs(
            AdminAccessAuditLog.objects.get(action='resolve_company_report').payload[
                'hold_applied'
            ],
            False,
        )

    def test_holding_the_page_needs_the_page_moderation_permission(self):
        resolver = make_limited_admin(
            self.superuser, 'company_report.view', 'company_report.resolve'
        )
        moderator = make_limited_admin(
            self.superuser,
            'company_report.view',
            'company_report.resolve',
            'company_page.moderate',
        )

        self.client.force_authenticate(resolver)
        denied = self.resolve(apply_hold=True)
        self.report.refresh_from_db()
        status_after_denial = self.report.status
        self.client.force_authenticate(moderator)
        allowed = self.resolve(apply_hold=True)

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.data['code'], 'admin_permission_denied')
        self.assertEqual(status_after_denial, CompanyReport.Status.PENDING)
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertIs(allowed.data['company']['content_policy_hold'], True)

    def test_reverse_reopens_the_report_and_keeps_the_hold(self):
        self.resolve(apply_hold=True)

        missing_note = self.reopen(note='  ')
        response = self.reopen()
        second_reverse = self.reopen()

        self.assertEqual(missing_note.status_code, 400)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(set(response.data), ROW_KEYS)
        self.assertEqual(
            (
                response.data['status'],
                response.data['resolution_note'],
                response.data['resolved_at'],
                response.data['resolved_by_email'],
            ),
            ('pending', '', None, ''),
        )
        self.assertEqual(
            [
                (event['from_status'], event['to_status'], event['note'])
                for event in response.data['resolution_history']
            ],
            [('pending', 'upheld', UPHELD_NOTE), ('upheld', 'pending', REOPEN_NOTE)],
        )
        # Reopening a report never restores the page it hid.
        self.assertIs(response.data['company']['content_policy_hold'], True)
        self.assertIs(Company.objects.get(pk=self.company.pk).content_policy_hold, True)
        self.assertEqual(CompanyPageEvent.objects.count(), 1)
        audit = AdminAccessAuditLog.objects.get(action='reverse_company_report')
        self.assertEqual(
            (audit.actor, audit.target_type, audit.target_public_id),
            (self.superuser, 'company_report', self.report.public_id),
        )
        self.assertEqual(audit.payload, {'from_status': 'upheld', 'note': REOPEN_NOTE})
        self.assertEqual(second_reverse.status_code, 400)
        self.assertEqual(
            second_reverse.data,
            {'detail': 'Báo cáo này chưa có kết luận để mở lại.'},
        )

    def test_reopened_report_can_be_resolved_again(self):
        self.resolve(status='dismissed', note='Thông tin trên trang là đúng.')
        self.reopen()

        response = self.resolve()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [
                (event['from_status'], event['to_status'])
                for event in response.data['resolution_history']
            ],
            [('pending', 'dismissed'), ('dismissed', 'pending'), ('pending', 'upheld')],
        )

    def test_reverse_is_refused_while_the_reporter_has_a_newer_pending_report(self):
        self.resolve()
        newer = self.make_report(reason=CompanyReport.Reason.SCAM)

        response = self.reopen()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {'detail': 'Người báo cáo đã có một báo cáo khác đang chờ xử lý cho công ty này.'},
        )
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, CompanyReport.Status.UPHELD)
        self.assertEqual(self.report.resolution_note, UPHELD_NOTE)
        self.assertEqual(self.report.resolution_history.count(), 1)
        self.assertEqual(newer.resolution_history.count(), 0)
        self.assertFalse(AdminAccessAuditLog.objects.filter(action='reverse_company_report'))

    def test_upheld_report_leaves_the_recruiter_trust_badge_alone(self):
        owner = add_recruiter(self.company)
        badge_key = (self.company.pk, owner.pk)
        self.report.reason = CompanyReport.Reason.SCAM
        self.report.save(update_fields=['reason'])
        before = employer_badge_state_map({badge_key})[badge_key]

        self.resolve(apply_hold=True)

        after = employer_badge_state_map({badge_key})[badge_key]
        self.assertIs(before['no_report_history'], True)
        self.assertEqual(after, before)
        self.assertFalse(JobReport.objects.exists())


class CompanyReportEvidenceTests(CompanyReportTestCase):
    def test_reports_and_their_history_cannot_be_removed_or_rewritten(self):
        report = self.make_report()
        resolve_company_report(
            report=report,
            status=CompanyReport.Status.UPHELD,
            actor=self.superuser,
            note=UPHELD_NOTE,
        )
        event = CompanyReportResolutionEvent.objects.get(report=report)

        event.note = 'Đã sửa'
        for mutate in (report.delete, event.save, event.delete):
            with self.assertRaises(ValueError):
                mutate()

        self.assertEqual(
            CompanyReportResolutionEvent.objects.get(pk=event.pk).note,
            UPHELD_NOTE,
        )

    def test_snapshot_keeps_the_names_the_page_had_when_reported(self):
        report = self.make_report()

        Company.objects.filter(pk=self.company.pk).update(
            company_name='Công ty Đã Đổi Tên',
            trade_name='Tên Mới',
        )
        resolve_company_report(
            report=report,
            status=CompanyReport.Status.UPHELD,
            actor=self.superuser,
            note=UPHELD_NOTE,
        )

        report.refresh_from_db()
        self.assertEqual(
            (report.company_name_snapshot, report.trade_name_snapshot),
            ('Công ty TNHH Phần mềm Alpha', 'Alpha Tech'),
        )


class CompanyReportConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='report-concurrent-admin@example.com',
            password='Password@123',
        )
        self.company = make_company(
            make_employer('report-concurrent-creator@example.com'),
            name='Công ty Đồng Thời',
        )
        self.candidates = [
            make_candidate(f'report-concurrent-{index}@example.com') for index in range(2)
        ]

    def _race(self, *commands):
        """Run every command on its own connection at once; collect outcomes."""
        gate = Barrier(len(commands))

        def run(command):
            close_old_connections()
            try:
                gate.wait(timeout=5)
                try:
                    command()
                except ValidationError:
                    return 'rejected'
                return 'done'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=len(commands)) as pool:
            return list(pool.map(run, commands))

    def _submit(self, candidate):
        return submit_company_report(
            company=self.company,
            reporter=candidate,
            reason=CompanyReport.Reason.WRONG_INFO,
        )

    def _resolve(self, report, **kwargs):
        resolve_company_report(
            report=report,
            status=CompanyReport.Status.UPHELD,
            actor=self.admin,
            note=UPHELD_NOTE,
            **kwargs,
        )

    def test_simultaneous_submissions_keep_one_pending_report(self):
        outcomes = self._race(*[lambda: self._submit(self.candidates[0])] * 2)

        self.assertCountEqual(outcomes, ['done', 'rejected'])
        self.assertEqual(CompanyReport.objects.count(), 1)

    def test_simultaneous_resolutions_record_exactly_one_transition(self):
        report = self._submit(self.candidates[0])

        outcomes = self._race(*[lambda: self._resolve(report)] * 2)

        self.assertCountEqual(outcomes, ['done', 'rejected'])
        report.refresh_from_db()
        self.assertEqual(report.status, CompanyReport.Status.UPHELD)
        self.assertEqual(report.resolution_history.count(), 1)
        self.assertEqual(
            AdminAccessAuditLog.objects.filter(action='resolve_company_report').count(),
            1,
        )

    def test_simultaneous_resolution_and_reverse_stay_in_step_with_history(self):
        report = self._submit(self.candidates[0])
        self._resolve(report)

        outcomes = self._race(
            lambda: self._resolve(report),
            lambda: reverse_company_report(report=report, actor=self.admin, note=REOPEN_NOTE),
        )

        report.refresh_from_db()
        history = list(report.resolution_history.values_list('from_status', 'to_status'))
        # The reverse always wins the upheld report; the resolution only
        # succeeds if it runs after the report is pending again.
        self.assertEqual(history[:2], [('pending', 'upheld'), ('upheld', 'pending')])
        self.assertEqual(len(history), 2 + (outcomes[0] == 'done'))
        self.assertEqual(report.status, history[-1][1])
        self.assertEqual(outcomes[1], 'done')

    def test_simultaneous_holds_from_two_reports_hide_the_page_once(self):
        reports = [self._submit(candidate) for candidate in self.candidates]

        outcomes = self._race(
            *[lambda report=report: self._resolve(report, apply_hold=True) for report in reports]
        )

        self.assertEqual(outcomes, ['done', 'done'])
        self.assertIs(Company.objects.get(pk=self.company.pk).content_policy_hold, True)
        self.assertEqual(CompanyPageEvent.objects.count(), 1)
        self.assertEqual(
            sorted(
                AdminAccessAuditLog.objects.filter(action='resolve_company_report').values_list(
                    'payload__hold_applied', flat=True
                )
            ),
            [False, True],
        )
