"""Employer workspace of the company page: policy, layout, pins and editors."""

import json
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User
from apps.jobs.models import Job

from ..models import (
    Company,
    CompanyImage,
    CompanyPageEditorGrant,
    CompanyPageEvent,
    CompanyPageSettings,
    CompanyPinnedJob,
    CompanyUpdateRequest,
    EmployerActivity,
    EmployerComplianceHold,
    EmployerNotification,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
from ..models.page_access import resolve_company_page_access
from ..page_registry import ACCENT_PALETTE, MAIN_SECTION_KEYS
from ..services import company_unlink_impact, confirm_company_unlink
from .company_page_helpers import (
    add_recruiter,
    make_candidate,
    make_company,
    make_employer,
    publish_job,
)
from .test_api import PNG_BYTES

MEMBER = RecruiterProfile.CompanyRole.MEMBER
DEFAULT_ORDER = list(MAIN_SECTION_KEYS)
JOB_REFERENCE_KEYS = {'public_id', 'title', 'slug', 'published_at'}
PUBLIC_PROFILE_KEYS = {
    'public_id',
    'slug',
    'canonical_path',
    'indexable',
    'identity',
    'stats',
    'theme',
    'sections',
    'sidebar',
}
MEDIA_FORBIDDEN = 'người được cấp quyền biên tập'


class CompanyPageWorkspaceTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.creator = make_employer('workspace-creator@example.com')
        self.company = make_company(
            self.creator,
            name='Công ty TNHH Phần mềm Alpha',
            trade_name='Alpha Tech',
            industry=Industry.objects.create(name='Công nghệ thông tin'),
            address='17 Duy Tân, Cầu Giấy, Hà Nội',
            description='<p>Giới thiệu công ty.</p>',
            employee_benefits='<ul><li>Bảo hiểm sức khoẻ</li></ul>',
        )
        CompanyImage.objects.create(company=self.company, image_url='employers/alpha/office.png')
        self.owner = self._named(add_recruiter(self.company), 'An Chủ Sở Hữu')
        self.member = self._named(add_recruiter(self.company, role=MEMBER), 'Bình Thành Viên')
        self.page_url = reverse('employer-company-page')
        self.layout_url = reverse('employer-company-page-layout')
        self.pinnable_url = reverse('employer-company-page-pinnable-jobs')
        self.editors_url = reverse('employer-company-page-editors')
        self.client.force_authenticate(self.owner)

    def _named(self, user, full_name):
        user.full_name = full_name
        user.save(update_fields=['full_name'])
        return user

    def grant(self, user):
        return CompanyPageEditorGrant.objects.create(
            company=self.company,
            recruiter=user.recruiter_profile,
            granted_by=self.owner,
        )

    def editor_url(self, grant):
        return reverse('employer-company-page-editor-detail', args=[grant.public_id])

    def patch_layout(self, **body):
        body.setdefault('lock_version', 0)
        return self.client.patch(self.layout_url, body, format='json')

    def public_detail(self):
        return self.client.get(reverse('public-company-detail', args=[self.company.slug])).data

    def lapse_verification(self, user):
        EmployerVerificationCase.objects.filter(recruiter__user=user).update(
            status=EmployerVerificationCase.Status.EXPIRED
        )

    def hold(self, user):
        EmployerComplianceHold.objects.create(
            recruiter=user.recruiter_profile,
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_HOLD,
        )


class CompanyPagePermissionMatrixTests(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        self.spare = add_recruiter(self.company, role=MEMBER)
        self.granted = add_recruiter(self.company, role=MEMBER)
        self.granted_grant = self.grant(self.granted)
        self.lapsed = add_recruiter(self.company, role=MEMBER)
        self.grant(self.lapsed)
        self.lapse_verification(self.lapsed)
        self.held = add_recruiter(self.company, role=MEMBER)
        self.grant(self.held)
        self.hold(self.held)
        unverified_company = make_company(self.creator, name='Công ty Chưa Xác Thực')
        self.unverified_owner = add_recruiter(unverified_company, approved=False)
        self.without_company = make_employer('workspace-no-company@example.com')
        self.candidate = make_candidate('workspace-candidate@example.com')

    def _statuses(self, grant_to_revoke):
        spare_id = self.spare.recruiter_profile.public_id
        return [
            self.client.get(self.page_url).status_code,
            self.patch_layout().status_code,
            self.client.get(self.pinnable_url).status_code,
            self.client.get(self.editors_url).status_code,
            self.client.post(self.editors_url, {'member_id': spare_id}, format='json').status_code,
            self.client.delete(self.editor_url(grant_to_revoke)).status_code,
        ]

    def test_workspace_endpoints(self):
        view_only = [200, 403, 403, 403, 403, 403]
        cases = [
            # user, [page, layout, pinnable, editors, grant, revoke], flags, blocker codes
            (None, [401] * 6, None, None),
            (self.candidate, [403] * 6, None, None),
            (self.without_company, [404] * 6, None, None),
            (
                self.unverified_owner,
                view_only,
                (False, False),
                ['OWNER_NOT_VERIFIED', 'NOT_VERIFIED'],
            ),
            (self.member, view_only, (False, False), ['NO_GRANT']),
            (self.lapsed, view_only, (False, False), ['NOT_VERIFIED']),
            (self.held, view_only, (False, False), ['COMPLIANCE_HOLD']),
            (self.granted, [200, 200, 200, 403, 403, 403], (True, False), []),
        ]
        for user, expected, flags, blockers in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)

                self.assertEqual(self._statuses(self.granted_grant), expected)
                if flags is None:
                    continue
                permissions = self.client.get(self.page_url).data['permissions']
                self.assertEqual(
                    permissions,
                    {
                        'can_view': True,
                        'can_edit_layout': flags[0],
                        'can_edit_content': flags[0],
                        'can_manage_editors': flags[1],
                        'blockers': permissions['blockers'],
                    },
                )
                self.assertEqual([item['code'] for item in permissions['blockers']], blockers)
                for item in permissions['blockers']:
                    self.assertSetEqual(set(item), {'code', 'message'})
                    self.assertTrue(item['message'])

        # Nobody above could change who edits the page.
        self.assertEqual(CompanyPageEditorGrant.objects.filter(revoked_at=None).count(), 3)
        self.assertFalse(CompanyPageSettings.objects.exists())

    def test_verified_owner_can_do_everything(self):
        self.client.force_authenticate(self.owner)
        spare_id = self.spare.recruiter_profile.public_id

        statuses = [
            self.client.get(self.page_url).status_code,
            self.patch_layout(accent='ocean').status_code,
            self.client.get(self.pinnable_url).status_code,
            self.client.get(self.editors_url).status_code,
            self.client.post(self.editors_url, {'member_id': spare_id}, format='json').status_code,
        ]
        revoked = self.client.delete(
            self.editor_url(CompanyPageEditorGrant.objects.get(recruiter__user=self.spare))
        )

        self.assertEqual(statuses, [200, 200, 200, 200, 201])
        self.assertEqual(revoked.status_code, 200, revoked.data)
        self.assertEqual(
            self.client.get(self.page_url).data['permissions'],
            {
                'can_view': True,
                'can_edit_layout': True,
                'can_edit_content': True,
                'can_manage_editors': True,
                'blockers': [],
            },
        )

    def test_owner_losing_eligibility_closes_the_page_for_every_editor(self):
        self.hold(self.owner)

        for user, blockers in (
            (self.owner, ['OWNER_NOT_VERIFIED', 'COMPLIANCE_HOLD']),
            (self.granted, ['OWNER_NOT_VERIFIED']),
            (self.member, ['OWNER_NOT_VERIFIED', 'NO_GRANT']),
        ):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user)

                permissions = self.client.get(self.page_url).data['permissions']
                self.assertEqual([item['code'] for item in permissions['blockers']], blockers)
                self.assertIs(permissions['can_edit_layout'], False)
                self.assertEqual(self.patch_layout(accent='ocean').status_code, 403)

    def test_forbidden_edit_names_its_code(self):
        self.client.force_authenticate(self.member)

        response = self.patch_layout(accent='ocean')

        self.assertEqual(response.status_code, 403)
        self.assertSetEqual(set(response.data), {'code', 'detail'})
        self.assertEqual(response.data['code'], 'COMPANY_PAGE_EDIT_FORBIDDEN')

    def test_policy_costs_one_query_beyond_loading_the_company(self):
        recruiter = RecruiterProfile.objects.get(user=self.granted)

        with self.assertNumQueries(2):
            access = resolve_company_page_access(recruiter)

        self.assertIs(access.can_edit_content, True)
        self.assertEqual(access.blockers, ())

    def _media_outcome(self, response):
        if response.status_code != 400:
            return response.status_code
        return 'forbidden' if MEDIA_FORBIDDEN in str(response.data.get('detail', '')) else 'allowed'

    def test_media_endpoints_accept_the_owner_or_an_effective_editor(self):
        image = CompanyImage.objects.get(company=self.company)
        cases = [
            (None, 401),
            (self.candidate, 403),
            (self.without_company, 404),
            (self.owner, 'allowed'),
            (self.granted, 'allowed'),
            (self.member, 'forbidden'),
            (self.lapsed, 'forbidden'),
            (self.held, 'forbidden'),
        ]
        for user, expected in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)
                upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')

                outcomes = [
                    self._media_outcome(
                        self.client.post(
                            reverse('employer-company-logo-upload'),
                            {'file': upload},
                            format='multipart',
                        )
                    ),
                    self._media_outcome(
                        self.client.delete(reverse('employer-company-logo-upload'))
                    ),
                    self._media_outcome(
                        self.client.delete(reverse('employer-company-cover-upload'))
                    ),
                    self._media_outcome(
                        self.client.delete(
                            reverse('employer-company-image-delete', args=[image.pk])
                        )
                    ),
                ]

                # Past the guard, a verified company still needs an update request.
                self.assertEqual(outcomes, [expected] * 4)

        self.assertTrue(CompanyImage.objects.filter(pk=image.pk).exists())

    def test_unverified_owner_keeps_the_legacy_media_rule(self):
        self.client.force_authenticate(self.unverified_owner)

        response = self.client.delete(reverse('employer-company-logo-upload'))

        self.assertEqual(response.status_code, 200, response.data)

    def test_delegated_editor_stages_a_logo_and_a_lapsed_one_cannot(self):
        def upload_logo(user):
            self.client.force_authenticate(user)
            update_request = CompanyUpdateRequest.objects.create(
                company=self.company,
                requested_by=user,
                changes={'logo_pending': True},
            )
            return update_request, self.client.post(
                reverse('employer-company-logo-upload'),
                {
                    'file': SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png'),
                    'update_request': update_request.public_id,
                },
                format='multipart',
            )

        staged_request, staged = upload_logo(self.granted)
        lapsed_request, refused = upload_logo(self.lapsed)

        self.assertEqual(staged.status_code, 200, staged.data)
        staged_request.refresh_from_db()
        self.assertTrue(staged_request.changes['logo_url'].startswith('employers/'))
        self.assertEqual(self._media_outcome(refused), 'forbidden')
        lapsed_request.refresh_from_db()
        self.assertEqual(lapsed_request.changes, {'logo_pending': True})


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
            {'company', 'permissions', 'registry', 'layout', 'pinned_jobs', 'content', 'stats'},
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
        self.assertSetEqual(set(data['registry']), {'sections', 'accents', 'limits'})
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
        self.assertEqual(data['registry']['limits'], {'pinned_jobs': 3})
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
        self.assertEqual(notification.action_path, '/tuyendung/app/company-page')
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
