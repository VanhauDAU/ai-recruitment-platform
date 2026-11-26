"""Employer workspace of the company page: reads, layout, pins and editors."""

import json
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User
from apps.employers.domain.page_registry import ACCENT_PALETTE
from apps.jobs.models import Job

from ..models import (
    Company,
    CompanyPageEditorGrant,
    CompanyPageEvent,
    CompanyPageSettings,
    CompanyPinnedJob,
    EmployerActivity,
    EmployerNotification,
    RecruiterProfile,
)
from ..services import company_unlink_impact, confirm_company_unlink
from .cases import (
    DEFAULT_ORDER,
    JOB_REFERENCE_KEYS,
    MEMBER,
    PUBLIC_PROFILE_KEYS,
    CompanyPageWorkspaceTestCase,
)
from .factories import (
    add_recruiter,
    make_company,
    publish_job,
)


class CompanyPageWorkspaceReadTests(CompanyPageWorkspaceTestCase):
    def test_workspace_payload_key_sets(self):
        job = publish_job(self.company, self.owner)
        CompanyPinnedJob.objects.create(company=self.company, job=job, sort_order=0)
        Company.objects.filter(pk=self.company.pk).update(follower_count=12)

        response = self.client.get(self.page_url)

        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertSetEqual(
            set(data),
            {
                'company',
                'permissions',
                'registry',
                'layout',
                'pinned_jobs',
                'content',
                'content_form',
                'completeness',
                'stats',
            },
        )
        self.assertEqual(
            data['company'],
            {
                'public_id': self.company.public_id,
                'slug': self.company.slug,
                'display_name': 'Alpha Tech',
                'public_path': f'/cong-ty/{self.company.slug}',
                'is_public': True,
                'is_indexable': True,
            },
        )
        self.assertSetEqual(
            set(data['permissions']),
            {'can_view', 'can_edit_layout', 'can_edit_content', 'can_manage_editors', 'blockers'},
        )
        self.assertSetEqual(
            set(data['registry']),
            {'sections', 'accents', 'social_networks', 'limits'},
        )
        self.assertEqual(
            [
                (item['key'], item['zone'], item['always_on'])
                for item in data['registry']['sections']
            ],
            [
                ('about', 'main', False),
                ('jobs', 'main', True),
                ('benefits', 'main', False),
                ('culture', 'main', False),
                ('gallery', 'main', False),
                ('video', 'main', False),
                ('general_info', 'sidebar', True),
                ('offices', 'sidebar', False),
                ('social_links', 'sidebar', False),
                ('share', 'sidebar', True),
                ('similar_companies', 'sidebar', True),
            ],
        )
        for item in data['registry']['sections']:
            self.assertSetEqual(set(item), {'key', 'title', 'zone', 'always_on'})
        self.assertEqual(
            [item['key'] for item in data['registry']['accents']],
            list(ACCENT_PALETTE),
        )
        self.assertEqual(
            data['registry']['accents'][0],
            {
                'key': 'brand',
                'label': 'Xanh ProCV',
                'primary': '#00b14f',
                'hover': '#008a3e',
                'soft': '#f0fbf5',
            },
        )
        for item in data['registry']['accents']:
            self.assertSetEqual(set(item), {'key', 'label', 'primary', 'hover', 'soft'})
            self.assertTrue(item['label'])
        self.assertEqual(
            data['registry']['limits'],
            {'pinned_jobs': 3, 'benefits': 8, 'offices': 10, 'gallery': 10, 'headline': 160},
        )
        self.assertEqual(
            data['layout'],
            {
                'section_order': DEFAULT_ORDER,
                'hidden_sections': [],
                'accent': 'brand',
                'pinned_job_public_ids': [job.public_id],
                'lock_version': 0,
            },
        )
        self.assertEqual(
            data['pinned_jobs'],
            [
                {
                    'public_id': job.public_id,
                    'title': job.title,
                    'slug': job.slug,
                    'published_at': job.published_at,
                }
            ],
        )
        self.assertSetEqual(set(data['content']), PUBLIC_PROFILE_KEYS)
        self.assertEqual(data['stats'], {'follower_count': 12, 'active_public_job_count': 1})
        self.assertFalse(CompanyPageSettings.objects.exists())

    def test_held_page_is_reported_as_not_public(self):
        Company.objects.filter(pk=self.company.pk).update(content_policy_hold=True)

        company = self.client.get(self.page_url).data['company']

        self.assertEqual((company['is_public'], company['is_indexable']), (False, False))

    def test_workspace_never_exposes_private_company_or_member_data(self):
        Company.objects.filter(pk=self.company.pk).update(
            tax_code='0101234567',
            email='private-contact@alpha.example',
        )

        payload = json.dumps(self.client.get(self.page_url).data, ensure_ascii=False, default=str)

        for private_value in (
            '0101234567',
            'private-contact@alpha.example',
            self.member.email,
            self.owner.email,
        ):
            with self.subTest(private_value=private_value):
                self.assertNotIn(private_value, payload)


class CompanyPageLayoutTests(CompanyPageWorkspaceTestCase):
    def test_layout_reaches_the_public_page_at_once(self):
        updated_at = Company.objects.get(pk=self.company.pk).updated_at
        order = ['gallery', 'jobs', 'about', 'video', 'culture', 'benefits']

        response = self.patch_layout(
            section_order=order,
            hidden_sections=['social_links', 'offices', 'benefits', 'benefits'],
            accent='ocean',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data['layout'],
            {
                'section_order': order,
                'hidden_sections': ['benefits', 'offices', 'social_links'],
                'accent': 'ocean',
                'pinned_job_public_ids': [],
                'lock_version': 1,
            },
        )
        # The editor still sees every block with content, in registry order.
        content = response.data['content']
        self.assertEqual(
            [block['key'] for block in content['sections']],
            ['about', 'jobs', 'benefits', 'gallery'],
        )
        self.assertIn('offices', [block['key'] for block in content['sidebar']])
        self.assertEqual(content['theme']['accent']['key'], 'brand')

        public = self.public_detail()
        self.assertEqual(
            [block['key'] for block in public['sections']], ['gallery', 'jobs', 'about']
        )
        self.assertEqual(
            [block['key'] for block in public['sidebar']],
            ['general_info', 'share', 'similar_companies'],
        )
        self.assertEqual(public['theme'], {'accent': {'key': 'ocean', **ACCENT_PALETTE['ocean']}})

        self.assertEqual(Company.objects.get(pk=self.company.pk).updated_at, updated_at)
        saved = CompanyPageSettings.objects.get(company=self.company)
        self.assertEqual((saved.updated_by, saved.lock_version), (self.owner, 1))
        event = CompanyPageEvent.objects.get(company=self.company)
        self.assertEqual(event.event_type, CompanyPageEvent.EventType.LAYOUT_UPDATED)
        self.assertEqual(event.actor, self.owner)
        self.assertEqual(
            event.payload,
            {
                'before': {
                    'section_order': DEFAULT_ORDER,
                    'hidden_sections': [],
                    'accent': 'brand',
                },
                'after': {
                    'section_order': order,
                    'hidden_sections': ['benefits', 'offices', 'social_links'],
                    'accent': 'ocean',
                },
            },
        )

    def test_partial_patch_keeps_the_other_choices(self):
        self.patch_layout(accent='rose', hidden_sections=['gallery'])

        response = self.patch_layout(lock_version=1, hidden_sections=[])

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            (response.data['layout']['accent'], response.data['layout']['hidden_sections']),
            ('rose', []),
        )
        self.assertEqual(response.data['layout']['lock_version'], 2)

    def test_stale_lock_version_returns_the_current_layout(self):
        self.patch_layout(accent='teal')

        response = self.patch_layout(lock_version=0, accent='rose')

        self.assertEqual(response.status_code, 409)
        self.assertSetEqual(set(response.data), {'code', 'detail', 'layout'})
        self.assertEqual(response.data['code'], 'COMPANY_PAGE_LAYOUT_STALE')
        self.assertEqual(
            response.data['layout'],
            {
                'section_order': DEFAULT_ORDER,
                'hidden_sections': [],
                'accent': 'teal',
                'pinned_job_public_ids': [],
                'lock_version': 1,
            },
        )
        self.assertEqual(CompanyPageSettings.objects.get().accent, 'teal')
        self.assertEqual(CompanyPageEvent.objects.count(), 1)

    def test_stale_first_save_leaves_no_settings_row(self):
        response = self.patch_layout(lock_version=4, accent='rose')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['layout']['lock_version'], 0)
        self.assertFalse(CompanyPageSettings.objects.exists())

    def test_unchanged_layout_is_not_a_new_version(self):
        self.patch_layout(accent='teal')

        response = self.patch_layout(lock_version=1, accent='teal', section_order=DEFAULT_ORDER)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['layout']['lock_version'], 1)
        self.assertEqual(CompanyPageEvent.objects.count(), 1)

    def test_layout_is_validated_against_the_registry(self):
        other_company = make_company(self.creator, name='Công ty Khác')
        foreign_job = publish_job(other_company, add_recruiter(other_company))
        closed_job = publish_job(self.company, self.owner, status=Job.Status.CLOSED)
        jobs = [publish_job(self.company, self.owner) for _ in range(4)]
        invalid_bodies = [
            ({}, 'lock_version'),
            ({'lock_version': -1}, 'lock_version'),
            ({'lock_version': 0, 'hidden_sections': ['hero']}, 'hidden_sections'),
            ({'lock_version': 0, 'hidden_sections': ['jobs']}, 'hidden_sections'),
            ({'lock_version': 0, 'hidden_sections': ['share']}, 'hidden_sections'),
            ({'lock_version': 0, 'section_order': DEFAULT_ORDER[:-1]}, 'section_order'),
            ({'lock_version': 0, 'section_order': [*DEFAULT_ORDER, 'about']}, 'section_order'),
            (
                {'lock_version': 0, 'section_order': [*DEFAULT_ORDER[:-1], 'offices']},
                'section_order',
            ),
            ({'lock_version': 0, 'accent': 'neon'}, 'accent'),
            ({'lock_version': 0, 'accent': '#ff0000'}, 'accent'),
            ({'lock_version': 0, 'pinned_job_public_ids': ['jb_unknown']}, 'pinned_job_public_ids'),
            (
                {'lock_version': 0, 'pinned_job_public_ids': [foreign_job.public_id]},
                'pinned_job_public_ids',
            ),
            (
                {'lock_version': 0, 'pinned_job_public_ids': [closed_job.public_id]},
                'pinned_job_public_ids',
            ),
            (
                {'lock_version': 0, 'pinned_job_public_ids': [job.public_id for job in jobs]},
                'pinned_job_public_ids',
            ),
            (
                {'lock_version': 0, 'pinned_job_public_ids': [jobs[0].public_id] * 2},
                'pinned_job_public_ids',
            ),
        ]

        for body, field in invalid_bodies:
            with self.subTest(body=body):
                response = self.client.patch(self.layout_url, body, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertSetEqual(set(response.data), {field})
                # Field errors are always a list of sentences shown verbatim.
                self.assertIsInstance(response.data[field], list)
                self.assertTrue(str(response.data[field][0]).strip())

        self.assertFalse(CompanyPageSettings.objects.exists())
        self.assertFalse(CompanyPinnedJob.objects.exists())
        self.assertFalse(CompanyPageEvent.objects.exists())

    def test_valid_layout_and_invalid_pin_change_nothing_together(self):
        response = self.patch_layout(accent='rose', pinned_job_public_ids=['jb_unknown'])

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CompanyPageSettings.objects.exists())

    def test_saved_order_survives_a_registry_that_gained_or_lost_blocks(self):
        CompanyPageSettings.objects.create(
            company=self.company,
            section_order=['gallery', 'retired_block', 'about'],
            hidden_sections=[],
            accent='retired_colour',
        )

        layout = self.client.get(self.page_url).data['layout']
        public = self.public_detail()

        self.assertEqual(
            layout['section_order'],
            ['gallery', 'about', 'jobs', 'benefits', 'culture', 'video'],
        )
        self.assertEqual(layout['accent'], 'brand')
        self.assertEqual(
            [block['key'] for block in public['sections']],
            ['gallery', 'about', 'jobs', 'benefits'],
        )
        self.assertEqual(public['theme']['accent']['key'], 'brand')

    def test_layout_changes_are_throttled_and_reads_are_not(self):
        try:
            with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'company_page_layout': '2/hour'}):
                changes = [
                    self.patch_layout(accent='teal'),
                    self.patch_layout(lock_version=1, accent='rose'),
                    self.patch_layout(lock_version=2, accent='ocean'),
                ]
                read = self.client.get(self.page_url)
        finally:
            cache.clear()

        self.assertEqual([response.status_code for response in changes], [200, 200, 429])
        self.assertEqual(read.status_code, 200)


class CompanyPagePinnedJobTests(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        now = timezone.now()
        self.jobs = [
            publish_job(
                self.company,
                self.owner,
                title=f'Vị trí {index}',
                published_at=now - timedelta(days=index),
            )
            for index in range(4)
        ]

    def _company_job_ids(self, **params):
        response = self.client.get(
            reverse('job-list'), {'company': self.company.public_id, **params}
        )
        return [job['public_id'] for job in response.data['results']]

    def test_pins_are_saved_in_order_and_lead_the_company_job_list(self):
        newest_first = [job.public_id for job in self.jobs]
        pinned = [self.jobs[3].public_id, self.jobs[1].public_id]
        updated_at = Company.objects.get(pk=self.company.pk).updated_at

        response = self.patch_layout(pinned_job_public_ids=pinned)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['layout']['pinned_job_public_ids'], pinned)
        self.assertEqual(response.data['layout']['lock_version'], 1)
        self.assertEqual([job['public_id'] for job in response.data['pinned_jobs']], pinned)
        for job in response.data['pinned_jobs']:
            self.assertSetEqual(set(job), JOB_REFERENCE_KEYS)
        self.assertEqual(
            list(
                CompanyPinnedJob.objects.filter(company=self.company).values_list(
                    'job__public_id', 'sort_order', 'pinned_by'
                )
            ),
            [(pinned[0], 0, self.owner.pk), (pinned[1], 1, self.owner.pk)],
        )
        event = CompanyPageEvent.objects.get(company=self.company)
        self.assertEqual(event.event_type, CompanyPageEvent.EventType.PINNED_JOBS_UPDATED)
        self.assertEqual(event.payload, {'before': [], 'after': pinned})
        self.assertEqual(Company.objects.get(pk=self.company.pk).updated_at, updated_at)

        jobs_block = next(
            block for block in self.public_detail()['sections'] if block['key'] == 'jobs'
        )
        self.assertEqual(jobs_block['pinned_job_public_ids'], pinned)
        self.assertEqual(
            self._company_job_ids(),
            [*pinned, self.jobs[0].public_id, self.jobs[2].public_id],
        )
        # An explicit sort, or a list that is not one company's, ignores pins.
        self.assertEqual(self._company_job_ids(ordering='newest'), newest_first)
        everything = self.client.get(reverse('job-list')).data['results']
        self.assertEqual([job['public_id'] for job in everything], newest_first)

    def test_replacing_and_clearing_pins(self):
        first = [self.jobs[0].public_id, self.jobs[1].public_id]
        second = [self.jobs[2].public_id, self.jobs[0].public_id, self.jobs[3].public_id]
        self.patch_layout(pinned_job_public_ids=first)

        replaced = self.patch_layout(lock_version=1, pinned_job_public_ids=second)
        unchanged = self.patch_layout(lock_version=2, pinned_job_public_ids=second)
        cleared = self.patch_layout(lock_version=2, pinned_job_public_ids=[])

        self.assertEqual(replaced.data['layout']['pinned_job_public_ids'], second)
        self.assertEqual(unchanged.data['layout']['lock_version'], 2)
        self.assertEqual(cleared.data['layout']['pinned_job_public_ids'], [])
        self.assertEqual(cleared.data['layout']['lock_version'], 3)
        self.assertFalse(CompanyPinnedJob.objects.exists())
        self.assertEqual(
            list(CompanyPageEvent.objects.order_by('id').values_list('payload', flat=True)),
            [
                {'before': [], 'after': first},
                {'before': first, 'after': second},
                {'before': second, 'after': []},
            ],
        )

    def test_pin_of_a_job_that_left_the_public_site_is_not_shown(self):
        pinned = [self.jobs[0].public_id, self.jobs[1].public_id]
        self.patch_layout(pinned_job_public_ids=pinned)
        Job.objects.filter(pk=self.jobs[0].pk).update(status=Job.Status.CLOSED)

        workspace = self.client.get(self.page_url).data
        jobs_block = next(
            block for block in self.public_detail()['sections'] if block['key'] == 'jobs'
        )

        self.assertEqual(workspace['layout']['pinned_job_public_ids'], [pinned[1]])
        self.assertEqual([job['public_id'] for job in workspace['pinned_jobs']], [pinned[1]])
        self.assertEqual(jobs_block['pinned_job_public_ids'], [pinned[1]])
        self.assertEqual(self._company_job_ids()[0], pinned[1])

    def test_pinnable_jobs_are_the_public_jobs_of_the_company_newest_first(self):
        other_company = make_company(self.creator, name='Công ty Khác')
        publish_job(other_company, add_recruiter(other_company), title='Vị trí công ty khác')
        publish_job(self.company, self.owner, title='Vị trí đã đóng', status=Job.Status.CLOSED)
        publish_job(self.company, self.member, title='Vị trí nháp', status=Job.Status.DRAFT)
        publish_job(
            self.company,
            self.owner,
            title='Vị trí bị tạm ẩn',
            moderation_hold=Job.ModerationHold.MANUAL_REVIEW,
        )
        self.grant(self.member)
        self.client.force_authenticate(self.member)

        response = self.client.get(self.pinnable_url)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(set(response.data), {'results'})
        # The delegate sees the owner's public jobs and not their own draft:
        # the list is the public predicate, never the recruiter's tenant scope.
        self.assertEqual(
            [job['public_id'] for job in response.data['results']],
            [job.public_id for job in self.jobs],
        )
        for job in response.data['results']:
            self.assertSetEqual(set(job), JOB_REFERENCE_KEYS)
        payload = json.dumps(response.data, ensure_ascii=False, default=str)
        for private_value in (
            self.owner.email,
            self.member.email,
            'posted_by',
            'candidate',
            'application',
        ):
            self.assertNotIn(private_value, payload)

    def test_pinnable_jobs_search_is_accent_insensitive_and_capped(self):
        for index in range(22):
            publish_job(self.company, self.owner, title=f'Kỹ sư phần mềm {index:02d}')

        searched = self.client.get(self.pinnable_url, {'q': 'ky su phan mem'})
        missing = self.client.get(self.pinnable_url, {'q': 'kế toán'})

        self.assertEqual(len(searched.data['results']), 20)
        self.assertTrue(all('Kỹ sư' in job['title'] for job in searched.data['results']))
        self.assertEqual(missing.data, {'results': []})


class CompanyPageEditorTests(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        self.member_id = self.member.recruiter_profile.public_id

    def grant_member(self, member_id=None):
        return self.client.post(
            self.editors_url,
            {'member_id': member_id or self.member_id},
            format='json',
        )

    def test_editor_rows_list_owner_first_without_identifiers(self):
        unverified = self._named(
            add_recruiter(self.company, approved=False, role=MEMBER), 'Cường Chưa Xác Thực'
        )
        RecruiterProfile.objects.filter(user=self.member).update(position_title='Chuyên viên')

        response = self.client.get(self.editors_url)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(set(response.data), {'results'})
        rows = response.data['results']
        for row in rows:
            self.assertSetEqual(
                set(row),
                {
                    'member_id',
                    'display_name',
                    'position_title',
                    'email_masked',
                    'company_role',
                    'eligible',
                    'grant',
                },
            )
        self.assertEqual(
            [
                (row['display_name'], row['company_role'], row['eligible'], row['grant'])
                for row in rows
            ],
            [
                ('An Chủ Sở Hữu', 'owner', True, None),
                ('Bình Thành Viên', 'member', True, None),
                ('Cường Chưa Xác Thực', 'member', False, None),
            ],
        )
        self.assertEqual(rows[1]['member_id'], self.member_id)
        self.assertEqual(rows[1]['position_title'], 'Chuyên viên')
        self.assertEqual(rows[1]['email_masked'], f'p***@{self.member.email.partition("@")[2]}')
        payload = json.dumps(response.data, ensure_ascii=False, default=str)
        for user in (self.owner, self.member, unverified):
            self.assertNotIn(user.email, payload)
            self.assertNotIn(user.public_id, payload)

    def test_grant_opens_the_page_for_the_member_and_notifies_them(self):
        response = self.grant_member()

        self.assertEqual(response.status_code, 201, response.data)
        grant = CompanyPageEditorGrant.objects.get()
        self.assertTrue(grant.public_id.startswith('cpg_'))
        self.assertEqual(
            (grant.company, grant.recruiter, grant.granted_by, grant.revoked_at),
            (self.company, self.member.recruiter_profile, self.owner, None),
        )
        self.assertEqual(response.data['member_id'], self.member_id)
        self.assertEqual(
            response.data['grant'],
            {
                'public_id': grant.public_id,
                'granted_at': grant.granted_at,
                'granted_by_name': 'An Chủ Sở Hữu',
                'effective': True,
            },
        )
        event = CompanyPageEvent.objects.get(company=self.company)
        self.assertEqual(event.event_type, CompanyPageEvent.EventType.EDITOR_GRANTED)
        self.assertEqual(event.actor, self.owner)
        self.assertEqual(
            event.payload,
            {'grant_public_id': grant.public_id, 'recruiter_public_id': self.member_id},
        )
        notification = EmployerNotification.objects.get(recipient=self.member)
        self.assertEqual(
            notification.event_type,
            EmployerNotification.EventType.COMPANY_PAGE_EDITOR_GRANTED,
        )
        self.assertEqual(notification.title, 'Bạn được cấp quyền biên tập trang công ty')
        self.assertEqual(notification.action_path, '/tuyendung/app/trang-cong-ty')
        self.assertEqual(notification.metadata, {'company_public_id': self.company.public_id})
        activity = EmployerActivity.objects.get(recipient=self.member)
        self.assertEqual(
            (activity.actor, activity.event_type), (self.owner, notification.event_type)
        )
        self.assertFalse(EmployerNotification.objects.filter(recipient=self.owner).exists())

        self.client.force_authenticate(self.member)
        self.assertEqual(self.patch_layout(accent='ocean').status_code, 200)

    def test_grant_is_refused_for_the_owner_unverified_and_granted_members(self):
        unverified = add_recruiter(self.company, approved=False, role=MEMBER)
        other_company = make_company(self.creator, name='Công ty Khác')
        outsider = add_recruiter(other_company, role=MEMBER)
        self.grant_member()
        cases = [
            (self.owner.recruiter_profile.public_id, 400, 'EDITOR_IS_OWNER'),
            (unverified.recruiter_profile.public_id, 400, 'EDITOR_NOT_VERIFIED'),
            (self.member_id, 400, 'EDITOR_ALREADY_GRANTED'),
            (outsider.recruiter_profile.public_id, 404, None),
            ('rec_unknown', 404, None),
        ]

        for member_id, expected_status, code in cases:
            with self.subTest(member_id=member_id, code=code):
                response = self.grant_member(member_id)
                self.assertEqual(response.status_code, expected_status)
                if code:
                    self.assertSetEqual(set(response.data), {'code', 'detail'})
                    self.assertEqual(response.data['code'], code)

        self.assertEqual(self.client.post(self.editors_url, {}, format='json').status_code, 400)
        self.assertEqual(CompanyPageEditorGrant.objects.count(), 1)

    def test_revoke_closes_the_grant_and_notifies_the_member(self):
        self.grant_member()
        grant = CompanyPageEditorGrant.objects.get()

        response = self.client.delete(self.editor_url(grant))
        again = self.client.delete(self.editor_url(grant))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['member_id'], self.member_id)
        self.assertIsNone(response.data['grant'])
        self.assertEqual(again.status_code, 404)
        grant.refresh_from_db()
        self.assertIsNotNone(grant.revoked_at)
        self.assertEqual((grant.revoked_by, grant.revoke_reason), (self.owner, 'owner_revoked'))
        self.assertEqual(
            list(
                CompanyPageEvent.objects.filter(company=self.company)
                .order_by('id')
                .values_list('event_type', 'payload__reason')
            ),
            [('editor_granted', None), ('editor_revoked', 'owner_revoked')],
        )
        self.assertEqual(
            list(
                EmployerNotification.objects.filter(recipient=self.member)
                .order_by('id')
                .values_list('event_type', flat=True)
            ),
            ['company_page_editor_granted', 'company_page_editor_revoked'],
        )
        self.client.force_authenticate(self.member)
        self.assertEqual(self.patch_layout(accent='ocean').status_code, 403)

    def test_member_can_be_granted_again_after_a_revoke(self):
        self.grant_member()
        self.client.delete(self.editor_url(CompanyPageEditorGrant.objects.get()))

        response = self.grant_member()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CompanyPageEditorGrant.objects.count(), 2)
        self.assertEqual(CompanyPageEditorGrant.objects.filter(revoked_at=None).count(), 1)
        self.assertEqual(EmployerNotification.objects.filter(recipient=self.member).count(), 3)

    def test_owner_cannot_revoke_a_grant_of_another_company(self):
        other_company = make_company(self.creator, name='Công ty Khác')
        add_recruiter(other_company)
        outsider = add_recruiter(other_company, role=MEMBER)
        foreign_grant = CompanyPageEditorGrant.objects.create(
            company=other_company,
            recruiter=outsider.recruiter_profile,
        )

        response = self.client.delete(self.editor_url(foreign_grant))

        self.assertEqual(response.status_code, 404)
        foreign_grant.refresh_from_db()
        self.assertIsNone(foreign_grant.revoked_at)

    def test_grant_of_a_lapsed_member_stays_listed_but_is_not_effective(self):
        self.grant_member()
        self.lapse_verification(self.member)

        row = self.client.get(self.editors_url).data['results'][1]

        self.assertIs(row['eligible'], False)
        self.assertIs(row['grant']['effective'], False)

    def test_editor_changes_are_throttled_and_the_list_is_not(self):
        try:
            with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'company_page_editors': '2/hour'}):
                self.grant_member()
                grant = CompanyPageEditorGrant.objects.get()
                changes = [
                    self.client.delete(self.editor_url(grant)).status_code,
                    self.grant_member().status_code,
                ]
                read = self.client.get(self.editors_url)
        finally:
            cache.clear()

        self.assertEqual(changes, [200, 429])
        self.assertEqual(read.status_code, 200)

    def test_admin_unlink_revokes_the_members_grant(self):
        admin = User.objects.create_superuser(
            email='workspace-unlink-admin@example.com',
            password='Password@123',
        )
        # Only a member without verification history can be unlinked.
        leaver = add_recruiter(self.company, approved=False, role=MEMBER)
        grant = self.grant(leaver)
        reason = 'Nhà tuyển dụng xác nhận đã chọn nhầm công ty.'
        impact = company_unlink_impact(leaver, actor=admin, reason=reason)

        confirm_company_unlink(
            leaver,
            actor=admin,
            reason=reason,
            impact_token=impact['impact_token'],
        )

        grant.refresh_from_db()
        self.assertIsNotNone(grant.revoked_at)
        self.assertEqual((grant.revoked_by, grant.revoke_reason), (admin, 'company_unlinked'))
        event = CompanyPageEvent.objects.get(company=self.company)
        self.assertEqual(event.event_type, CompanyPageEvent.EventType.EDITOR_REVOKED)
        self.assertEqual(event.payload['reason'], 'company_unlinked')
        self.assertIsNone(RecruiterProfile.objects.get(user=leaver).company)
