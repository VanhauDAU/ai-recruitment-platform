"""Who may do what in the company page workspace."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from ..models import (
    CompanyImage,
    CompanyPageEditorGrant,
    CompanyPageSettings,
    CompanyUpdateRequest,
    RecruiterProfile,
)
from ..models.page_access import resolve_company_page_access
from .cases import MEDIA_FORBIDDEN, MEMBER, CompanyPageWorkspaceTestCase
from .factories import (
    PNG_BYTES,
    add_recruiter,
    make_candidate,
    make_company,
    make_employer,
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
