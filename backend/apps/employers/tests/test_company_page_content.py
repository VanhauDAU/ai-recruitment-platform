"""Page content through admin moderation: validation, merge, apply and render."""

import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.jobs.models import Benefit
from apps.locations.models import Location

from ..models import (
    Company,
    CompanyBenefit,
    CompanyOffice,
    CompanyUpdateEvent,
    CompanyUpdateRequest,
)
from ..page_content import normalize_video_url, video_embed
from ..services import (
    CompanyUpdateConflict,
    apply_update_request,
    normalize_page_content_changes,
    start_company_update_review,
)
from .company_page_helpers import add_recruiter
from .test_api import PNG_BYTES
from .test_company_page_seo import SHELL, _structured_data
from .test_company_page_workspace import MEMBER, CompanyPageWorkspaceTestCase

LONG_DESCRIPTION = '<p>' + 'Alpha xây dựng sản phẩm phần mềm cho doanh nghiệp. ' * 12 + '</p>'
CULTURE = '<p>Làm việc <strong>minh bạch</strong>, học hỏi mỗi ngày.</p>'


def _province(code, name):
    return Location.objects.create(code=code, level=Location.Level.PROVINCE, name=name)


class PageContentValidationTests(CompanyPageWorkspaceTestCase):
    """``normalize_page_content_changes`` runs on submission and on approval."""

    def setUp(self):
        super().setUp()
        self.hanoi = _province('P01', 'Hà Nội')
        self.ward = Location.objects.create(
            code='W01',
            level=Location.Level.WARD,
            name='Phường Dịch Vọng',
            parent=self.hanoi,
        )
        self.insurance = Benefit.objects.create(name='Bảo hiểm sức khoẻ CP6', icon='shield')
        self.retired = Benefit.objects.create(name='Phúc lợi đã ngừng CP6', is_active=False)

    def errors(self, **changes):
        with self.assertRaises(ValidationError) as caught:
            normalize_page_content_changes(changes)
        return caught.exception.detail

    def test_headline_is_one_line_of_plain_text(self):
        self.assertEqual(
            normalize_page_content_changes({'headline': '  Kiến tạo \n  tương lai  '}),
            {'headline': 'Kiến tạo tương lai'},
        )
        self.assertEqual(normalize_page_content_changes({'headline': ''}), {'headline': ''})
        for value in ('<script>alert(1)</script>', '<b>Đậm</b>', 'x' * 161, 12):
            with self.subTest(value=value):
                self.assertIn('headline', self.errors(headline=value))

    def test_culture_is_sanitized_rich_text_up_to_5000_visible_characters(self):
        cleaned = normalize_page_content_changes(
            {
                'culture': '<p onclick="x()">Văn hoá</p><script>alert(1)</script><a href="javascript:x">l</a>'
            }
        )

        self.assertEqual(cleaned['culture'], '<p>Văn hoá</p>l')
        self.assertIn('culture', self.errors(culture='<p>' + 'a' * 5001 + '</p>'))
        self.assertEqual(
            normalize_page_content_changes({'culture': '<p>' + 'a' * 5000 + '</p>'})['culture'],
            '<p>' + 'a' * 5000 + '</p>',
        )

    def test_video_urls_are_stored_canonical_and_embedded_click_to_load(self):
        youtube = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        cases = {
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s': youtube,
            'http://youtube.com/watch?v=dQw4w9WgXcQ': youtube,
            'https://m.youtube.com/watch?v=dQw4w9WgXcQ': youtube,
            'https://youtu.be/dQw4w9WgXcQ': youtube,
            'https://www.youtube.com/shorts/dQw4w9WgXcQ': youtube,
            ' https://vimeo.com/76979871 ': 'https://vimeo.com/76979871',
            '': '',
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(normalize_video_url(value), expected)

        self.assertEqual(
            video_embed(youtube),
            {
                'provider': 'youtube',
                'video_id': 'dQw4w9WgXcQ',
                'embed_url': 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            },
        )
        self.assertEqual(
            video_embed('https://vimeo.com/76979871')['embed_url'],
            'https://player.vimeo.com/video/76979871',
        )
        for value in (
            'javascript:alert(1)',
            '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
            'https://www.youtube.com/embed/dQw4w9WgXcQ',
            'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
            'https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ',
            'https://www.youtube.com/watch?v=short',
            'https://vimeo.com/channels/staffpicks',
            'https://user:pass@vimeo.com/76979871',
            'ftp://vimeo.com/76979871',
        ):
            with self.subTest(value=value):
                self.assertIn('video_url', self.errors(video_url=value))

    def test_social_links_follow_the_network_host_allowlist(self):
        cleaned = normalize_page_content_changes(
            {
                'social_links': {
                    'facebook': ' https://m.facebook.com/alpha ',
                    'linkedin': 'https://vn.linkedin.com/company/alpha',
                    'youtube': '',
                    'instagram': 'https://www.instagram.com/alpha',
                }
            }
        )

        self.assertEqual(
            cleaned['social_links'],
            {
                'facebook': 'https://m.facebook.com/alpha',
                'linkedin': 'https://vn.linkedin.com/company/alpha',
                'instagram': 'https://www.instagram.com/alpha',
            },
        )
        for network, value in (
            ('facebook', 'javascript:alert(1)'),
            ('facebook', 'http://facebook.com/alpha'),
            ('facebook', 'https://facebook.com.evil.example/alpha'),
            ('facebook', 'https://evilfacebook.com/alpha'),
            ('linkedin', 'https://facebook.com/alpha'),
            ('tiktok', 'https://www.tiktok.com/'),
            ('youtube', 'https://user@youtube.com/@alpha'),
            ('instagram', 42),
        ):
            with self.subTest(network=network, value=value):
                errors = self.errors(social_links={network: value})
                self.assertEqual(list(errors['social_links']), [network])
        self.assertIn(
            'social_links', self.errors(social_links={'myspace': 'https://myspace.com/a'})
        )
        self.assertIn('social_links', self.errors(social_links=['https://facebook.com/alpha']))

    def test_benefits_are_active_catalogue_entries_with_short_notes(self):
        cleaned = normalize_page_content_changes(
            {'benefits': [{'benefit_id': self.insurance.pk, 'note': '  Cho cả  gia đình '}]}
        )

        self.assertEqual(
            cleaned['benefits'],
            [{'benefit_id': self.insurance.pk, 'note': 'Cho cả gia đình'}],
        )
        many = [Benefit.objects.create(name=f'Phúc lợi CP6 {index}') for index in range(9)]
        cases = [
            ([{'benefit_id': self.retired.pk}], {0: ['benefit_id']}),
            ([{'benefit_id': 999_999}], {0: ['benefit_id']}),
            ([{'benefit_id': str(self.insurance.pk)}], {0: ['benefit_id']}),
            (
                [{'benefit_id': self.insurance.pk}, {'benefit_id': self.insurance.pk}],
                {1: ['benefit_id']},
            ),
            ([{'benefit_id': self.insurance.pk, 'note': '<script>x</script>'}], {0: ['note']}),
            ([{'benefit_id': self.insurance.pk, 'note': 'x' * 161}], {0: ['note']}),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                errors = self.errors(benefits=value)['benefits']
                self.assertEqual({index: sorted(item) for index, item in errors.items()}, expected)
        self.assertIsInstance(
            self.errors(benefits=[{'benefit_id': item.pk} for item in many])['benefits'],
            list,
        )
        self.assertIsInstance(self.errors(benefits={'benefit_id': 1})['benefits'], list)

    def test_offices_need_a_province_and_at_most_one_headquarters(self):
        office = {
            'label': ' Văn phòng  Hà Nội ',
            'address_line': '17 Duy Tân',
            'province_id': self.hanoi.pk,
        }

        cleaned = normalize_page_content_changes({'offices': [office]})

        self.assertEqual(
            cleaned['offices'],
            [
                {
                    'label': 'Văn phòng Hà Nội',
                    'address_line': '17 Duy Tân',
                    'province_id': self.hanoi.pk,
                    'is_headquarters': False,
                }
            ],
        )
        cases = [
            ({**office, 'province_id': self.ward.pk}, ['province_id']),
            ({**office, 'province_id': None}, ['province_id']),
            ({**office, 'label': ''}, ['label']),
            ({**office, 'address_line': '<img src=x onerror=alert(1)>'}, ['address_line']),
            ({**office, 'is_headquarters': 'yes'}, ['is_headquarters']),
        ]
        for value, fields in cases:
            with self.subTest(value=value):
                self.assertEqual(sorted(self.errors(offices=[value])['offices'][0]), fields)
        headquarters = {**office, 'is_headquarters': True}
        self.assertIsInstance(self.errors(offices=[headquarters, headquarters])['offices'], list)
        self.assertIsInstance(self.errors(offices=[office] * 11)['offices'], list)


class PageContentEndpointTests(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        self.content_url = reverse('employer-company-page-content')
        self.update_requests_url = reverse('employer-company-update-requests')
        self.hanoi = _province('P01', 'Hà Nội')
        self.insurance = Benefit.objects.create(name='Bảo hiểm sức khoẻ CP6', icon='shield')

    def send(self, **changes):
        return self.client.post(self.content_url, {'changes': changes}, format='json')

    def active_request(self, user=None):
        return CompanyUpdateRequest.objects.get(
            requested_by=user or self.owner,
            status__in=['submitted', 'changes_requested', 'in_review'],
        )

    def test_permission_matrix(self):
        granted = add_recruiter(self.company, role=MEMBER)
        self.grant(granted)
        lapsed = add_recruiter(self.company, role=MEMBER)
        self.grant(lapsed)
        self.lapse_verification(lapsed)
        cases = [
            (None, 401),
            (User.objects.create_superuser(email='content-admin@example.com', password='x'), 403),
            (self.member, 403),
            (lapsed, 403),
            (granted, 200),
            (self.owner, 200),
        ]
        for user, expected in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)
                response = self.send(headline='Kiến tạo tương lai')
                self.assertEqual(response.status_code, expected, response.data)
                if expected == 403 and user is not None and user.role == User.Role.EMPLOYER:
                    self.assertEqual(response.data['code'], 'COMPANY_PAGE_EDIT_FORBIDDEN')

        self.assertEqual(
            sorted(CompanyUpdateRequest.objects.values_list('requested_by__email', flat=True)),
            sorted([granted.email, self.owner.email]),
        )

    def test_profile_form_refuses_page_content_from_a_non_editor_only(self):
        self.client.force_authenticate(self.member)

        forbidden = self.client.post(
            self.update_requests_url,
            {'changes': {'headline': 'Kiến tạo tương lai'}},
            format='json',
        )
        description = self.client.post(
            self.update_requests_url,
            {'changes': {'description': LONG_DESCRIPTION}},
            format='json',
        )
        self.client.force_authenticate(self.owner)
        editor = self.client.post(
            self.update_requests_url,
            {'changes': {'headline': 'Kiến tạo tương lai', 'culture': CULTURE}},
            format='json',
        )

        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(forbidden.data['code'], 'COMPANY_PAGE_EDIT_FORBIDDEN')
        self.assertEqual(description.status_code, 201, description.data)
        self.assertEqual(editor.status_code, 201, editor.data)
        self.assertEqual(
            editor.data['changes'],
            {'headline': 'Kiến tạo tương lai', 'culture': CULTURE},
        )

    def test_profile_form_still_replaces_the_open_request(self):
        first = self.client.post(
            self.update_requests_url,
            {'changes': {'headline': 'Một', 'culture': CULTURE}},
            format='json',
        )
        second = self.client.post(
            self.update_requests_url,
            {'changes': {'headline': 'Hai'}},
            format='json',
        )

        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(second.data['changes'], {'headline': 'Hai'})

    def test_merge_keeps_unrelated_keys_and_returns_the_workspace(self):
        first = self.send(headline='Kiến tạo tương lai')
        second = self.send(
            culture=CULTURE,
            benefits=[{'benefit_id': self.insurance.pk, 'note': 'Cho cả gia đình'}],
            social_links={'facebook': 'https://facebook.com/alpha'},
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertIn('content_form', second.data)
        update_request = self.active_request()
        self.assertEqual(
            update_request.changes,
            {
                'headline': 'Kiến tạo tương lai',
                'culture': CULTURE,
                'benefits': [{'benefit_id': self.insurance.pk, 'note': 'Cho cả gia đình'}],
                'social_links': {'facebook': 'https://facebook.com/alpha'},
            },
        )
        self.assertEqual(update_request.revision, 2)
        self.assertEqual(
            list(update_request.events.order_by('id').values_list('event_type', flat=True)),
            [CompanyUpdateEvent.EventType.SUBMITTED, CompanyUpdateEvent.EventType.REVISION_CREATED],
        )
        self.assertEqual(
            set(update_request.base_values),
            {'headline', 'culture', 'benefits', 'social_links'},
        )
        form = second.data['content_form']
        self.assertEqual(
            form['pending'],
            {
                'headline': 'Kiến tạo tương lai',
                'culture': CULTURE,
                'benefits': [{'benefit_id': self.insurance.pk, 'note': 'Cho cả gia đình'}],
                'social_links': {
                    'facebook': 'https://facebook.com/alpha',
                    'linkedin': '',
                    'youtube': '',
                    'tiktok': '',
                    'instagram': '',
                },
            },
        )
        self.assertEqual(
            form['request'],
            {
                'public_id': update_request.public_id,
                'status': 'submitted',
                'submitted_at': update_request.submitted_at,
                'review_note': '',
                'editable': True,
                'lock_version': update_request.lock_version,
                'allowed_actions': ['edit', 'withdraw', 'cancel'],
            },
        )

    def test_merge_keeps_the_legal_changes_of_the_same_request(self):
        self.client.post(
            self.update_requests_url,
            {'changes': {'company_size': Company.Size.S100_499}},
            format='json',
        )

        self.send(headline='Kiến tạo tương lai')

        self.assertEqual(
            self.active_request().changes,
            {'company_size': '100-499', 'headline': 'Kiến tạo tương lai'},
        )

    def test_a_key_sent_with_its_published_value_leaves_the_request(self):
        Company.objects.filter(pk=self.company.pk).update(headline='Đang công khai')
        self.send(headline='Bản mới', culture=CULTURE)

        response = self.send(headline='Đang công khai')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.active_request().changes, {'culture': CULTURE})
        self.assertEqual(set(self.active_request().base_values), {'culture'})
        self.assertEqual(response.data['content_form']['section_status']['hero'], 'published')
        self.assertEqual(response.data['content_form']['section_status']['culture'], 'pending')

    def test_reverting_every_key_withdraws_the_request(self):
        self.send(culture=CULTURE)
        update_request = self.active_request()

        response = self.send(culture='')
        nothing_to_send = self.send(culture='')

        self.assertEqual(response.status_code, 200, response.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.WITHDRAWN)
        self.assertIsNone(response.data['content_form']['request'])
        self.assertIsNone(response.data['content_form']['pending'])
        self.assertEqual(nothing_to_send.status_code, 400)
        self.assertIn('changes', nothing_to_send.data)

    def test_request_in_review_is_read_only(self):
        self.send(culture=CULTURE)
        update_request = self.active_request()
        start_company_update_review(
            update_request,
            actor=User.objects.create_superuser(email='content-review@example.com', password='x'),
            lock_version=update_request.lock_version,
        )

        response = self.send(headline='Kiến tạo tương lai')
        profile_form = self.client.post(
            self.update_requests_url,
            {'changes': {'headline': 'Kiến tạo tương lai'}},
            format='json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'COMPANY_UPDATE_IN_REVIEW')
        self.assertTrue(response.data['detail'])
        self.assertEqual(profile_form.status_code, 400)
        self.assertEqual(profile_form.data['code'], 'COMPANY_UPDATE_IN_REVIEW')
        update_request.refresh_from_db()
        self.assertEqual(update_request.changes, {'culture': CULTURE})

    def test_only_page_content_keys_are_accepted(self):
        response = self.send(company_name='Tên mới', headline='Kiến tạo')

        self.assertEqual(response.status_code, 400)
        self.assertIn('changes', response.data)
        self.assertFalse(CompanyUpdateRequest.objects.exists())

    def test_field_errors_are_keyed_by_field_and_index(self):
        cases = [
            ({'headline': '<script>alert(1)</script>'}, 'headline'),
            ({'video_url': 'https://evil.example/video'}, 'video_url'),
            ({'social_links': {'facebook': 'javascript:alert(1)'}}, 'social_links'),
            ({'benefits': [{'benefit_id': 999_999}]}, 'benefits'),
            ({'description': '<p>Quá ngắn</p>'}, 'description'),
        ]
        for changes, field in cases:
            with self.subTest(field=field):
                response = self.client.post(self.content_url, {'changes': changes}, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.data), [field])

        nested = self.send(offices=[{'label': '', 'address_line': 'x', 'province_id': 0}])
        self.assertEqual(sorted(nested.json()['offices']['0']), ['label', 'province_id'])
        self.assertFalse(CompanyUpdateRequest.objects.exists())

    def test_delegated_editor_stages_media_through_the_content_request(self):
        editor = add_recruiter(self.company, role=MEMBER)
        self.grant(editor)
        self.client.force_authenticate(editor)

        marked = self.send(logo_pending=True)
        request_id = marked.data['content_form']['request']['public_id']
        uploaded = self.client.post(
            reverse('employer-company-logo-upload'),
            {
                'file': SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png'),
                'update_request': request_id,
            },
            format='multipart',
        )
        workspace = self.client.get(self.page_url).data['content_form']

        self.assertEqual(marked.status_code, 200, marked.data)
        self.assertEqual(marked.data['content_form']['pending'], {'logo_pending': True})
        # A delegate is not the owner, so cancelling is not theirs to offer.
        self.assertEqual(
            marked.data['content_form']['request']['allowed_actions'],
            ['edit', 'withdraw'],
        )
        withdraw_url = reverse(
            'employer-company-update-request-lifecycle',
            args=[request_id, 'withdraw'],
        )
        self.assertEqual(uploaded.status_code, 200, uploaded.data)
        changes = CompanyUpdateRequest.objects.get(public_id=request_id).changes
        self.assertTrue(changes['logo_url'].startswith('employers/'))
        self.assertNotIn('logo_pending', changes)
        self.assertIn('/media/employers/', workspace['pending']['logo_url'])
        self.assertEqual(workspace['section_status']['hero'], 'pending')
        withdrawn = self.client.post(
            withdraw_url,
            {'lock_version': workspace['request']['lock_version']},
            format='json',
        )
        self.assertEqual(withdrawn.status_code, 200, withdrawn.data)
        self.assertIsNone(self.client.get(self.page_url).data['content_form']['request'])

    def test_content_submissions_are_throttled(self):
        from unittest.mock import patch

        from django.core.cache import cache
        from rest_framework.throttling import ScopedRateThrottle

        try:
            with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'company_page_content': '2/hour'}):
                statuses = [
                    self.send(headline=f'Khẩu hiệu {index}').status_code for index in range(3)
                ]
        finally:
            cache.clear()

        self.assertEqual(statuses, [200, 200, 429])


class PageContentApprovalTests(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_superuser(
            email='content-approver@example.com', password='x'
        )
        self.hanoi = _province('P01', 'Hà Nội')
        self.danang = _province('P48', 'Đà Nẵng')
        self.insurance = Benefit.objects.create(name='Bảo hiểm sức khoẻ CP6', icon='shield')
        self.laptop = Benefit.objects.create(
            name='Laptop làm việc CP6',
            icon='laptop',
            category=Benefit.Category.EQUIPMENT,
        )
        self.offices = [
            {
                'label': 'Trụ sở Hà Nội',
                'address_line': '17 Duy Tân',
                'province_id': self.hanoi.pk,
                'is_headquarters': True,
            },
            {
                'label': 'Chi nhánh Đà Nẵng',
                'address_line': '2 Bạch Đằng',
                'province_id': self.danang.pk,
                'is_headquarters': False,
            },
        ]
        self.changes = {
            'headline': 'Kiến tạo tương lai',
            'culture': CULTURE,
            'video_url': 'https://youtu.be/dQw4w9WgXcQ',
            'social_links': {'facebook': 'https://facebook.com/alpha'},
            'benefits': [
                {'benefit_id': self.laptop.pk, 'note': 'MacBook'},
                {'benefit_id': self.insurance.pk, 'note': ''},
            ],
            'offices': self.offices,
        }

    def submit(self, changes=None):
        self.client.post(
            reverse('employer-company-page-content'),
            {'changes': changes or self.changes},
            format='json',
        )
        update_request = CompanyUpdateRequest.objects.get(
            requested_by=self.owner,
            status=CompanyUpdateRequest.Status.SUBMITTED,
        )
        return start_company_update_review(
            update_request,
            actor=self.admin,
            lock_version=update_request.lock_version,
        )

    def approve(self, update_request):
        return apply_update_request(
            update_request,
            self.admin,
            decision=CompanyUpdateRequest.Status.APPROVED,
        )

    def test_approval_publishes_every_content_field(self):
        self.approve(self.submit())

        company = Company.objects.get(pk=self.company.pk)
        self.assertEqual(
            (company.headline, company.culture, company.video_url, company.social_links),
            (
                'Kiến tạo tương lai',
                CULTURE,
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                {'facebook': 'https://facebook.com/alpha'},
            ),
        )
        self.assertEqual(
            list(
                CompanyBenefit.objects.filter(company=company).values_list(
                    'benefit_id', 'note', 'sort_order'
                )
            ),
            [(self.laptop.pk, 'MacBook', 0), (self.insurance.pk, '', 1)],
        )
        offices = list(CompanyOffice.objects.filter(company=company))
        self.assertEqual(
            [(office.label, office.province_id, office.is_headquarters) for office in offices],
            [('Trụ sở Hà Nội', self.hanoi.pk, True), ('Chi nhánh Đà Nẵng', self.danang.pk, False)],
        )
        self.assertTrue(all(office.public_id.startswith('cof_') for office in offices))

        public = self.public_detail()
        self.assertEqual(public['identity']['headline'], 'Kiến tạo tương lai')
        sections = {block['key']: block for block in public['sections']}
        self.assertEqual(
            sections['benefits'],
            {
                'key': 'benefits',
                'type': 'benefits',
                'title': 'Phúc lợi',
                'items': [
                    {
                        'name': 'Laptop làm việc CP6',
                        'icon': 'laptop',
                        'category': 'equipment',
                        'note': 'MacBook',
                    },
                    {
                        'name': 'Bảo hiểm sức khoẻ CP6',
                        'icon': 'shield',
                        'category': 'other',
                        'note': '',
                    },
                ],
                'body_html': '<ul><li>Bảo hiểm sức khoẻ</li></ul>',
            },
        )
        self.assertEqual(
            sections['culture'],
            {
                'key': 'culture',
                'type': 'rich_text',
                'title': 'Văn hoá công ty',
                'body_html': CULTURE,
            },
        )
        self.assertEqual(
            sections['video'],
            {
                'key': 'video',
                'type': 'video',
                'title': 'Video giới thiệu',
                'provider': 'youtube',
                'video_id': 'dQw4w9WgXcQ',
                'embed_url': 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            },
        )
        sidebar = {block['key']: block for block in public['sidebar']}
        self.assertEqual(
            sidebar['offices']['items'],
            [
                {
                    'label': 'Trụ sở Hà Nội',
                    'address': '17 Duy Tân',
                    'province_name': 'Hà Nội',
                    'is_headquarters': True,
                },
                {
                    'label': 'Chi nhánh Đà Nẵng',
                    'address': '2 Bạch Đằng',
                    'province_name': 'Đà Nẵng',
                    'is_headquarters': False,
                },
            ],
        )
        self.assertEqual(
            sidebar['social_links'],
            {
                'key': 'social_links',
                'type': 'social_links',
                'title': 'Mạng xã hội',
                'items': [
                    {
                        'network': 'facebook',
                        'label': 'Facebook',
                        'url': 'https://facebook.com/alpha',
                    }
                ],
            },
        )

        workspace = self.client.get(self.page_url).data
        self.assertIsNone(workspace['content_form']['request'])
        self.assertEqual(
            workspace['content_form']['section_status'],
            {
                'hero': 'published',
                'about': 'published',
                'benefits': 'published',
                'culture': 'published',
                'gallery': 'published',
                'video': 'published',
                'offices': 'published',
                'social_links': 'published',
            },
        )
        self.assertEqual(
            workspace['content_form']['published']['offices'][0],
            {**self.offices[0], 'province_name': 'Hà Nội'},
        )
        # Logo and cover are still missing.
        self.assertEqual(workspace['completeness']['score'], 80)

    def test_a_later_approval_replaces_the_lists(self):
        self.approve(self.submit())

        self.approve(self.submit({'benefits': [], 'offices': self.offices[1:]}))

        self.assertFalse(CompanyBenefit.objects.filter(company=self.company).exists())
        self.assertEqual(
            list(
                CompanyOffice.objects.filter(company=self.company).values_list('label', flat=True)
            ),
            ['Chi nhánh Đà Nẵng'],
        )

    def test_approval_detects_a_conflict_on_the_lists(self):
        update_request = self.submit({'benefits': [{'benefit_id': self.laptop.pk, 'note': ''}]})
        CompanyBenefit.objects.create(company=self.company, benefit=self.insurance, sort_order=0)

        with self.assertRaises(CompanyUpdateConflict) as caught:
            self.approve(update_request)

        self.assertEqual(caught.exception.fields, ('benefits',))
        self.assertEqual(
            list(
                CompanyBenefit.objects.filter(company=self.company).values_list(
                    'benefit', flat=True
                )
            ),
            [self.insurance.pk],
        )

    def test_approval_rechecks_a_benefit_retired_since_submission(self):
        update_request = self.submit({'benefits': [{'benefit_id': self.laptop.pk, 'note': ''}]})
        Benefit.objects.filter(pk=self.laptop.pk).update(is_active=False)

        with self.assertRaises(ValidationError):
            self.approve(update_request)

    def test_admin_comparison_shows_readable_previews(self):
        CompanyBenefit.objects.create(company=self.company, benefit=self.insurance, sort_order=0)
        update_request = self.submit()
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse('admin-company-update-request-detail', args=[update_request.public_id])
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['changes']['headline'], 'Kiến tạo tương lai')
        self.assertEqual(
            response.data['changes']['social_links'],
            {'facebook': 'https://facebook.com/alpha'},
        )
        self.assertEqual(
            response.data['previews'],
            {
                'benefits': [
                    {'name': 'Laptop làm việc CP6', 'note': 'MacBook'},
                    {'name': 'Bảo hiểm sức khoẻ CP6', 'note': ''},
                ],
                'offices': [
                    {
                        'label': 'Trụ sở Hà Nội',
                        'address': '17 Duy Tân',
                        'province_name': 'Hà Nội',
                        'is_headquarters': True,
                    },
                    {
                        'label': 'Chi nhánh Đà Nẵng',
                        'address': '2 Bạch Đằng',
                        'province_name': 'Đà Nẵng',
                        'is_headquarters': False,
                    },
                ],
            },
        )
        current = response.data['current_values']
        self.assertEqual(current['benefits'], [{'name': 'Bảo hiểm sức khoẻ CP6', 'note': ''}])
        self.assertEqual(current['offices'], [])
        self.assertEqual((current['headline'], current['culture']), ('', ''))
        self.assertEqual(current['social_links'], {})


class PublicPageContentTests(CompanyPageWorkspaceTestCase):
    def setUp(self):
        super().setUp()
        self.hanoi = _province('P01', 'Hà Nội')

    def office(self, company, **overrides):
        values = {
            'company': company,
            'label': 'Trụ sở chính',
            'address_line': '99 Đường Riêng',
            'province': self.hanoi,
            'is_headquarters': True,
            'sort_order': 0,
        }
        values.update(overrides)
        return CompanyOffice.objects.create(**values)

    def structured_data(self, company):
        with override_settings(FRONTEND_SHELL_HTML=SHELL):
            html = self.client.get(reverse('seo-company-detail', args=[company.slug]))
        html = html.content.decode()
        return html, _structured_data(html)

    def test_household_company_never_shows_an_address(self):
        Company.objects.filter(pk=self.company.pk).update(
            business_type=Company.BusinessType.HOUSEHOLD,
            social_links={'facebook': 'https://facebook.com/alpha'},
        )
        self.office(self.company)

        public = self.public_detail()
        workspace = self.client.get(self.page_url).data
        html, organization = self.structured_data(self.company)

        self.assertNotIn('offices', [block['key'] for block in public['sidebar']])
        self.assertNotIn('99 Đường Riêng', json.dumps(public, ensure_ascii=False))
        self.assertNotIn(
            '99 Đường Riêng',
            json.dumps(workspace['content'], ensure_ascii=False),
        )
        self.assertNotIn('address', organization['Organization'])
        self.assertNotIn('99 Đường Riêng', html)
        self.assertEqual(organization['Organization']['sameAs'], ['https://facebook.com/alpha'])

    def test_json_ld_uses_the_headquarters_office_and_social_links(self):
        Company.objects.filter(pk=self.company.pk).update(
            website_url='https://alpha.example',
            social_links={'linkedin': 'https://linkedin.com/company/alpha'},
        )
        self.office(self.company, label='Chi nhánh', is_headquarters=False, sort_order=0)
        self.office(self.company, address_line='17 Duy Tân', sort_order=1)

        _, data = self.structured_data(self.company)

        organization = data['Organization']
        self.assertEqual(
            organization['sameAs'],
            ['https://alpha.example', 'https://linkedin.com/company/alpha'],
        )
        self.assertEqual(
            organization['address'],
            {
                '@type': 'PostalAddress',
                'streetAddress': '17 Duy Tân',
                'addressCountry': 'VN',
                'addressRegion': 'Hà Nội',
            },
        )

    def test_empty_content_adds_no_block(self):
        public = self.public_detail()

        self.assertEqual(public['identity']['headline'], '')
        keys = {block['key'] for block in public['sections'] + public['sidebar']}
        self.assertTrue(keys.isdisjoint({'culture', 'video', 'social_links'}))
        self.assertNotIn(
            'video',
            {block['key'] for block in self.client.get(self.page_url).data['content']['sections']},
        )


class WorkspaceContentFormTests(CompanyPageWorkspaceTestCase):
    def test_content_form_and_completeness_key_sets(self):
        data = self.client.get(self.page_url).data

        form = data['content_form']
        self.assertSetEqual(set(form), {'published', 'pending', 'request', 'section_status'})
        self.assertSetEqual(
            set(form['published']),
            {
                'headline',
                'description',
                'culture',
                'employee_benefits',
                'video_url',
                'social_links',
                'benefits',
                'offices',
                'logo_url',
                'cover_image_url',
                'gallery',
            },
        )
        self.assertEqual(
            form['published']['social_links'],
            {'facebook': '', 'linkedin': '', 'youtube': '', 'tiktok': '', 'instagram': ''},
        )
        self.assertEqual(len(form['published']['gallery']), 1)
        self.assertSetEqual(set(form['published']['gallery'][0]), {'id', 'image_url', 'caption'})
        self.assertIsNone(form['pending'])
        self.assertIsNone(form['request'])
        self.assertEqual(
            form['section_status'],
            {
                'hero': 'empty',
                'about': 'published',
                'benefits': 'published',
                'culture': 'empty',
                'gallery': 'published',
                'video': 'empty',
                'offices': 'empty',
                'social_links': 'empty',
            },
        )
        self.assertEqual(
            [(item['key'], item['done']) for item in data['completeness']['items']],
            [
                ('logo', False),
                ('cover', False),
                ('headline', False),
                ('about', True),
                ('benefits', True),
                ('culture', False),
                ('gallery', True),
                ('offices', False),
                ('social_links', False),
                ('video', False),
            ],
        )
        self.assertEqual(data['completeness']['score'], 30)
        for item in data['completeness']['items']:
            self.assertSetEqual(set(item), {'key', 'label', 'done'})
            self.assertTrue(item['label'])
        registry = data['registry']
        self.assertEqual(
            [network['key'] for network in registry['social_networks']],
            ['facebook', 'linkedin', 'youtube', 'tiktok', 'instagram'],
        )
        for network in registry['social_networks']:
            self.assertSetEqual(set(network), {'key', 'label', 'placeholder'})
        self.assertEqual(
            registry['limits'],
            {'pinned_jobs': 3, 'benefits': 8, 'offices': 10, 'gallery': 10, 'headline': 160},
        )

    def test_changes_requested_marks_the_blocks_of_the_request(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.owner,
            changes={'culture': CULTURE, 'gallery_deletions': [1]},
            status=CompanyUpdateRequest.Status.CHANGES_REQUESTED,
            review_note='Ảnh chưa rõ nét.',
        )

        form = self.client.get(self.page_url).data['content_form']

        self.assertEqual(form['section_status']['culture'], 'changes_requested')
        self.assertEqual(form['section_status']['gallery'], 'changes_requested')
        self.assertEqual(form['section_status']['about'], 'published')
        self.assertEqual(form['pending'], {'culture': CULTURE, 'gallery_deletions': [1]})
        self.assertEqual(form['request']['review_note'], 'Ảnh chưa rõ nét.')
        self.assertEqual(form['request']['status'], 'changes_requested')
        self.assertIs(form['request']['editable'], True)
        self.assertEqual(form['request']['public_id'], update_request.public_id)
        self.assertEqual(form['request']['lock_version'], update_request.lock_version)
        self.assertEqual(
            form['request']['allowed_actions'], ['edit', 'withdraw', 'resubmit', 'cancel']
        )

    def test_another_members_request_is_not_the_callers(self):
        CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.member,
            changes={'culture': CULTURE},
        )

        form = self.client.get(self.page_url).data['content_form']

        self.assertIsNone(form['request'])
        self.assertEqual(form['section_status']['culture'], 'empty')


class VideoParsingTests(SimpleTestCase):
    def test_stored_values_that_are_not_videos_render_nothing(self):
        for value in ('', 'https://example.com/v', 'javascript:alert(1)'):
            with self.subTest(value=value):
                self.assertIsNone(video_embed(value))
