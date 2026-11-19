"""Admin recruiter workspace: next action, search, segment counts and activity timeline."""

from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.domain import account_activity as rules
from apps.accounts.domain import recruiter_next_action as next_action
from apps.accounts.models import AccountStatusTransition, AdminAccessAuditLog, AuthSession, User
from apps.accounts.tests.factories import make_admin
from apps.employers.models import (
    Company,
    CompanyUpdateRequest,
    EmployerActivity,
    EmployerCompanyLinkEvent,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    RecruiterProfile,
)


def make_recruiter(email, *, company=None, case_status=None, submitted_hours_ago=None, **extra):
    user = User.objects.create_user(
        email,
        'Password@123',
        role=User.Role.EMPLOYER,
        status=extra.pop('status', User.Status.ACTIVE),
        email_verified=True,
        **extra,
    )
    recruiter = RecruiterProfile.objects.create(
        user=user,
        company=company,
        company_role=RecruiterProfile.CompanyRole.OWNER if company else '',
        registration_completed_at=timezone.now(),
    )
    if case_status:
        EmployerVerificationCase.objects.create(
            recruiter=recruiter,
            company=company,
            status=case_status,
            submitted_at=(
                timezone.now() - timedelta(hours=submitted_hours_ago)
                if submitted_hours_ago is not None
                else None
            ),
        )
    return user


class RecruiterListWorkspaceTests(TestCase):
    def setUp(self):
        self.admin = make_admin('workspace-admin@example.com')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.company = Company.objects.create(
            company_name='Công ty Cổ phần Ánh Dương',
            tax_code='0312345678',
            created_by=self.admin,
        )

    def list(self, **params):
        response = self.client.get(reverse('admin-account-list'), {'scope': 'recruiters', **params})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def codes(self, data):
        return {row['email']: row['context']['next_action']['code'] for row in data['results']}

    def test_next_action_ranks_filter_ordering_and_summary_agree(self):
        Status = EmployerVerificationCase.Status
        make_recruiter(
            'overdue@example.com',
            company=self.company,
            case_status=Status.PENDING,
            submitted_hours_ago=80,
        )
        other_company = Company.objects.create(
            company_name='Công ty B', tax_code='0399999999', created_by=self.admin
        )
        make_recruiter(
            'review@example.com',
            company=other_company,
            case_status=Status.IN_REVIEW,
            submitted_hours_ago=2,
        )
        update_company = Company.objects.create(
            company_name='Công ty C', tax_code='0388888888', created_by=self.admin
        )
        updater = make_recruiter(
            'update@example.com', company=update_company, case_status=Status.APPROVED
        )
        pending_update = CompanyUpdateRequest.objects.create(
            company=update_company,
            requested_by=updater,
            changes={'address': 'Địa chỉ mới'},
            submitted_at=timezone.now(),
        )
        make_recruiter('banned@example.com', status=User.Status.BANNED)
        make_recruiter(
            'resubmit@example.com',
            company=Company.objects.create(
                company_name='Công ty D', tax_code='0377777777', created_by=self.admin
            ),
            case_status=Status.CHANGES_REQUESTED,
        )
        make_recruiter('nocompany@example.com')

        codes = self.codes(self.list())
        self.assertEqual(codes['overdue@example.com'], next_action.VERIFICATION_OVERDUE)
        self.assertEqual(codes['review@example.com'], next_action.VERIFICATION_REVIEW)
        self.assertEqual(codes['update@example.com'], next_action.COMPANY_UPDATE_REVIEW)
        self.assertEqual(codes['banned@example.com'], next_action.ACCOUNT_RESTRICTED)
        self.assertEqual(codes['resubmit@example.com'], next_action.AWAITING_RESUBMISSION)
        self.assertEqual(codes['nocompany@example.com'], next_action.AWAITING_COMPANY)
        update_row = next(
            row for row in self.list()['results'] if row['email'] == 'update@example.com'
        )
        self.assertEqual(
            update_row['context']['next_action']['company_update_public_id'],
            pending_update.public_id,
        )

        queue = self.list(next_action='admin_queue', ordering='next_action')
        self.assertEqual(
            [row['email'] for row in queue['results']],
            ['overdue@example.com', 'review@example.com', 'update@example.com'],
        )
        summary = self.client.get(reverse('admin-account-summary'), {'scope': 'recruiters'}).data[
            'next_actions'
        ]
        self.assertEqual(summary['admin_queue'], queue['count'])
        self.assertEqual(summary[next_action.VERIFICATION_OVERDUE], 1)
        self.assertEqual(summary[next_action.AWAITING_RESUBMISSION], 1)

    def test_invalid_next_action_is_rejected(self):
        response = self.client.get(
            reverse('admin-account-list'), {'scope': 'recruiters', 'next_action': 'nope'}
        )
        self.assertEqual(response.status_code, 400)

    def test_search_matches_company_name_tax_code_and_phone(self):
        make_recruiter('found@example.com', company=self.company, phone='0912345678')
        make_recruiter('other@example.com')
        for query in ('anh duong', 'Ánh Dương', '12345678', '+84 912 345 678', '0912345678'):
            with self.subTest(query=query):
                emails = [row['email'] for row in self.list(q=query)['results']]
                self.assertEqual(emails, ['found@example.com'])

    def test_recruiter_list_query_count_does_not_grow_with_rows(self):
        make_recruiter('first@example.com', company=self.company)

        def count_queries():
            with CaptureQueriesContext(connection) as queries:
                self.list(page_size=60)
            return len(queries)

        baseline = count_queries()
        for index in range(9):
            company = Company.objects.create(
                company_name=f'Công ty {index}',
                tax_code=f'03000000{index:02d}',
                created_by=self.admin,
            )
            make_recruiter(f'row{index}@example.com', company=company)
        self.assertEqual(count_queries(), baseline)


class AccountActivityTimelineTests(TestCase):
    def setUp(self):
        self.admin = make_admin('timeline-admin@example.com')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.company = Company.objects.create(
            company_name='Công ty Nhật Ký', tax_code='0311111111', created_by=self.admin
        )
        self.user = make_recruiter(
            'timeline@example.com',
            company=self.company,
            case_status=EmployerVerificationCase.Status.PENDING,
            submitted_hours_ago=1,
        )
        self.recruiter = self.user.recruiter_profile
        self.case = self.recruiter.verification_case

    def activity(self, **params):
        response = self.client.get(
            reverse('admin-account-activity', kwargs={'public_id': self.user.public_id}), params
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def seed_sources(self):
        AuthSession.objects.create(
            user=self.user,
            portal=User.Role.EMPLOYER,
            refresh_jti='jti-1',
            device_label='Chrome trên macOS',
            ip_address='203.0.113.5',
            expires_at=timezone.now() + timedelta(days=7),
        )
        AdminAccessAuditLog.objects.create(
            actor=self.admin,
            source='api',
            action='revoke_account_sessions',
            target_type='user',
            target_public_id=self.user.public_id,
            payload={'reason': 'Nghi lộ mật khẩu', 'revoked_session_count': 2},
        )
        # Status audit rows duplicate the transition table and must not show twice.
        AdminAccessAuditLog.objects.create(
            actor=self.admin,
            source='api',
            action='temporarily_suspend_account',
            target_type='user',
            target_public_id=self.user.public_id,
        )
        AccountStatusTransition.objects.create(
            user=self.user,
            actor=self.admin,
            kind=AccountStatusTransition.Kind.SUSPEND,
            before_status=User.Status.ACTIVE,
            after_status=User.Status.INACTIVE,
            reason='Đăng tin sai sự thật',
        )
        EmployerVerificationEvent.objects.create(
            verification_case=self.case,
            actor=self.user,
            event_type=EmployerVerificationEvent.EventType.SUBMITTED,
        )
        EmployerCompanyLinkEvent.objects.create(
            recruiter=self.recruiter,
            company=self.company,
            actor=self.admin,
            event_type=EmployerCompanyLinkEvent.EventType.OWNER_ASSIGNED,
            reason='Chủ cũ đã nghỉ việc',
        )
        EmployerActivity.objects.create(
            recipient=self.user,
            event_type='application_received',
            dedupe_key='app-1',
            summary='Có hồ sơ mới cho tin Kế toán',
        )
        # Covered by the verification event table → skipped.
        EmployerActivity.objects.create(
            recipient=self.user,
            event_type='verification_approved',
            dedupe_key='ver-1',
            summary='Hồ sơ đã được duyệt',
        )

    def test_merges_sources_with_labels_categories_and_counts(self):
        self.seed_sources()
        data = self.activity()
        events = {entry['event']: entry for entry in data['results']}
        self.assertEqual(
            set(events),
            {
                'login',
                'revoke_account_sessions',
                'suspend',
                'submitted',
                'owner_assigned',
                'application_received',
            },
        )
        self.assertEqual(events['login']['category'], rules.SECURITY)
        self.assertEqual(events['login']['title'], 'Đăng nhập cổng NTD')
        self.assertEqual(events['suspend']['actor'], {'type': 'admin', 'label': self.admin.email})
        self.assertEqual(events['submitted']['actor']['type'], 'self')
        self.assertEqual(events['application_received']['category'], rules.RECRUITMENT)
        self.assertEqual(
            data['category_counts'],
            {
                'all': 6,
                'security': 2,
                'account': 1,
                'verification': 1,
                'company': 1,
                'recruitment': 1,
            },
        )
        occurred = [entry['occurred_at'] for entry in data['results']]
        self.assertEqual(occurred, sorted(occurred, reverse=True))

        security = self.activity(category='security')['results']
        self.assertEqual(
            {entry['event'] for entry in security}, {'login', 'revoke_account_sessions'}
        )

    def test_cursor_pages_never_skip_or_repeat_equal_timestamps(self):
        same_time = timezone.now() - timedelta(hours=1)
        logs = [
            AdminAccessAuditLog.objects.create(
                actor=self.admin,
                source='api',
                action='send_account_password_reset',
                target_type='user',
                target_public_id=self.user.public_id,
            )
            for _ in range(5)
        ]
        AdminAccessAuditLog.objects.filter(pk__in=[log.pk for log in logs]).update(
            created_at=same_time
        )
        event = EmployerVerificationEvent.objects.create(
            verification_case=self.case,
            event_type=EmployerVerificationEvent.EventType.SUBMITTED,
        )
        EmployerVerificationEvent.objects.filter(pk=event.pk).update(created_at=same_time)

        seen, cursor = [], None
        for _ in range(10):
            page = self.activity(limit=2, **({'before': cursor} if cursor else {}))
            seen.extend(entry['id'] for entry in page['results'])
            self.assertEqual('category_counts' in page, cursor is None)
            cursor = page['next_cursor']
            if not cursor:
                break
        self.assertEqual(len(seen), 6)
        self.assertEqual(len(set(seen)), 6)

    def test_candidate_timeline_only_reads_account_sources(self):
        candidate = User.objects.create_user(
            'candidate-timeline@example.com', 'Password@123', role=User.Role.CANDIDATE
        )
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(
                reverse('admin-account-activity', kwargs={'public_id': candidate.public_id})
            )
        self.assertEqual(response.status_code, 200)
        employer_sources = (
            'employers_employerverificationevent',
            'employers_employerphoneverificationevent',
            'employers_employercompanylinkevent',
            'employers_companyupdateevent',
            'employers_employeractivity',
        )
        self.assertFalse(
            any(
                table in query['sql']
                for query in queries.captured_queries
                for table in employer_sources
            )
        )

    def test_regular_admin_cannot_read_a_superuser_timeline(self):
        superuser = make_admin('root-timeline@example.com', superuser=True)
        response = self.client.get(
            reverse('admin-account-activity', kwargs={'public_id': superuser.public_id})
        )
        self.assertEqual(response.status_code, 404)

    def test_query_count_does_not_grow_with_entries(self):
        def count_queries():
            with CaptureQueriesContext(connection) as queries:
                self.activity(limit=50)
            return len(queries)

        self.seed_sources()
        baseline = count_queries()
        for index in range(20):
            EmployerActivity.objects.create(
                recipient=self.user,
                event_type='application_received',
                dedupe_key=f'bulk-{index}',
                summary='Có hồ sơ mới',
            )
            EmployerVerificationEvent.objects.create(
                verification_case=self.case,
                actor=self.admin,
                event_type=EmployerVerificationEvent.EventType.SENSITIVE_VIEWED,
            )
        self.assertEqual(count_queries(), baseline)


class AccountActivityRulesTests(TestCase):
    def test_cursor_round_trip_and_invalid_values(self):
        entry = {'occurred_at': timezone.now(), '_rank': 4, '_pk': 17}
        decoded = rules.decode_cursor(rules.encode_cursor(entry))
        self.assertEqual(decoded, (entry['occurred_at'], 4, '17'))
        self.assertIsNone(rules.decode_cursor('not-a-cursor'))
        self.assertIsNone(rules.decode_cursor(''))

    def test_limits_and_categories_are_clamped(self):
        self.assertEqual(rules.parse_limit('500'), rules.MAX_LIMIT)
        self.assertEqual(rules.parse_limit('x'), rules.DEFAULT_LIMIT)
        self.assertEqual(rules.parse_category('hack'), '')

    def test_every_user_target_audit_action_written_by_services_has_a_label(self):
        written = {
            'revoke_account_sessions',
            'send_account_password_reset',
            'resend_account_verification',
            'change_account_email',
            'update_account_profile',
            'reveal_account_sensitive_profile',
            'self_password_change',
            'self_profile_update',
            'self_session_revoke',
            'self_session_revoke_others',
        }
        self.assertEqual(written, rules.USER_TARGET_AUDIT_ACTIONS)


@patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay')
class ImpactPreviewReasonTests(TestCase):
    """Previews accept a blank reason (dialog opens first); confirms never do."""

    def setUp(self):
        self.admin = make_admin('preview-root@example.com', superuser=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.user = make_recruiter('preview-target@example.com')

    def post(self, name, payload):
        return self.client.post(
            reverse(f'admin-account-{name}', kwargs={'public_id': self.user.public_id}),
            payload,
            format='json',
        )

    def test_status_and_session_previews_allow_blank_reason_but_confirm_does_not(self, _delay):
        for preview, confirm, extra in (
            ('status-impact', 'change-status', {'status': User.Status.INACTIVE}),
            ('revoke-sessions-impact', 'revoke-sessions', {}),
        ):
            with self.subTest(preview=preview):
                with CaptureQueriesContext(connection) as queries:
                    impact = self.post(preview, {**extra, 'reason': ''})
                self.assertEqual(impact.status_code, 200, impact.data)
                self.assertFalse(
                    any(
                        query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE'))
                        for query in queries.captured_queries
                    )
                )
                blank = self.post(
                    confirm, {**extra, 'reason': '', 'impact_token': impact.data['impact_token']}
                )
                self.assertEqual(blank.status_code, 400)
                reused = self.post(
                    confirm,
                    {
                        **extra,
                        'reason': 'Lý do được nhập sau khi xem tác động',
                        'impact_token': impact.data['impact_token'],
                    },
                )
                self.assertEqual(reused.status_code, 409, reused.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.status, User.Status.ACTIVE)

    def test_ban_confirm_still_requires_evidence_and_category(self, _delay):
        impact = self.post('status-impact', {'status': User.Status.BANNED, 'reason': ''})
        self.assertEqual(impact.status_code, 200, impact.data)
        response = self.post(
            'change-status',
            {
                'status': User.Status.BANNED,
                'reason': 'Gian lận tuyển dụng',
                'impact_token': impact.data['impact_token'],
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('enforcement_evidence', response.data)
