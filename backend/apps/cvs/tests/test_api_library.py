"""Candidate CV library: create paths, metadata, duplicate, delete and access rules."""

from django.contrib.auth import get_user_model
from django.urls import reverse

from apps.candidates.models import CandidateConsent, CandidateProfile
from apps.cv_templates.models import (
    CvPositionProfile,
    CvSampleContent,
    CvTemplateVersion,
    empty_content,
    empty_layout,
    empty_style,
)
from apps.cvs.models import CvDraft, CvVersion, UserCv
from apps.cvs.tests.factories import cv_pdf_upload
from apps.jobs.models import JobCategory, JobCategoryLocalization
from apps.sitecontent.models import SiteSetting

from .api_case import CvApiTestCase


class CvLibraryApiTests(CvApiTestCase):
    def test_create_autosave_save_and_publish_follow_the_lifecycle_contract(self):
        cv = self.create_cv()
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)

        detail = self.client.get(reverse('cv-detail', kwargs={'public_id': cv.public_id}))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['template_renderer_key'], 'single_column_v1')
        self.assertEqual(detail.data['template_renderer_version'], '1')

        owner_view = self.client.get(self.owner_view_url(cv))
        self.assertEqual(owner_view.status_code, 200)
        self.assertIn('is_default', owner_view.data['cv'])

        draft_response = self.client.get(self.draft_url(cv))
        self.assertEqual(draft_response.status_code, 200)
        self.assertEqual(draft_response['ETag'], '"lock-version-0"')
        payload = {
            key: draft_response.data[key]
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['content_json']['personal_info']['full_name'] = 'Candidate V2'

        autosave = self.client.put(
            self.draft_url(cv),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(autosave.status_code, 200, autosave.data)
        self.assertEqual(autosave.data['lock_version'], 1)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)
        cv.draft.refresh_from_db()
        self.assertEqual(cv.draft.content_json['personal_info']['full_name'], 'Candidate V2')

        stale = self.client.put(
            self.draft_url(cv),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data['current_lock_version'], 1)

        saved = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['version_kind'], CvVersion.VersionKind.MANUAL_SAVE)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 2)

        published = self.client.post(
            reverse('cv-publish', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(published.status_code, 201, published.data)
        self.assertEqual(published.data['version_kind'], CvVersion.VersionKind.PUBLISHED)
        cv.refresh_from_db()
        self.assertEqual(cv.lifecycle_status, UserCv.LifecycleStatus.PUBLISHED)
        self.assertEqual(cv.published_version.public_id, published.data['public_id'])

    def test_create_can_copy_owned_draft_into_a_new_template(self):
        source = self.create_cv()
        draft_response = self.client.get(self.draft_url(source))
        payload = {
            key: draft_response.data[key]
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['content_json']['personal_info']['full_name'] = 'Preserved source identity'
        self.client.put(
            self.draft_url(source),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        alternate, _ = self.create_alternate_template()

        response = self.client.post(
            reverse('cv-list-create'),
            {
                'title': 'Copied CV',
                'template_public_id': alternate.public_id,
                'source_cv_public_id': source.public_id,
                'language': 'en-US',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        copied = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertNotEqual(copied.pk, source.pk)
        self.assertEqual(copied.language, 'vi-VN')
        self.assertEqual(
            copied.draft.content_json['personal_info']['full_name'], 'Preserved source identity'
        )
        self.assertEqual(copied.template_id, alternate.pk)

    def test_create_applies_only_a_color_available_for_the_template(self):
        response = self.client.post(
            reverse('cv-list-create'),
            {
                'title': 'Blue CV',
                'template_public_id': self.template.public_id,
                'language': 'vi-VN',
                'theme_color': '#2255aa',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        cv = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertEqual(cv.draft.style_json['theme_color'], '#2255AA')
        self.assertEqual(cv.latest_version.style_json['theme_color'], '#2255AA')

        invalid = self.client.post(
            reverse('cv-list-create'),
            {
                'title': 'Invalid color CV',
                'template_public_id': self.template.public_id,
                'language': 'vi-VN',
                'theme_color': '#FF0000',
            },
            format='json',
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('theme_color', invalid.data)

    def test_create_with_the_same_idempotency_key_returns_the_first_cv(self):
        """Bấm "Tạo CV" hai lần (hoặc gửi lại) chỉ tạo một CV."""
        payload = {
            'title': 'CV một lần',
            'template_public_id': self.template.public_id,
            'language': 'vi-VN',
        }
        url = reverse('cv-list-create')
        first = self.client.post(url, payload, format='json', HTTP_IDEMPOTENCY_KEY='click-1')
        again = self.client.post(url, payload, format='json', HTTP_IDEMPOTENCY_KEY='click-1')
        other = self.client.post(url, payload, format='json', HTTP_IDEMPOTENCY_KEY='click-2')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.data['public_id'], first.data['public_id'])
        self.assertEqual(other.status_code, 201)
        self.assertEqual(UserCv.objects.filter(title='CV một lần').count(), 2)

    def test_creation_requires_verified_email_and_a_published_template_version(self):
        unverified = get_user_model().objects.create_user(
            email='v2-unverified@example.com',
            password='password',
            role='candidate',
            email_verified=False,
        )
        self.client.force_authenticate(unverified)
        response = self.client.post(
            reverse('cv-list-create'),
            {'title': 'Blocked', 'template_public_id': self.template.public_id},
            format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(self.candidate)
        self.template.current_published_version = None
        self.template.save(update_fields=['current_published_version'])
        response = self.client.post(
            reverse('cv-list-create'),
            {'title': 'No release', 'template_public_id': self.template.public_id},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_creation_pins_the_current_published_template_version(self):
        next_version = CvTemplateVersion.objects.create(
            template=self.template,
            version_number=2,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
        )
        self.template.current_published_version = next_version
        self.template.save(update_fields=['current_published_version'])

        response = self.client.post(
            reverse('cv-list-create'),
            {
                'title': 'Pinned CV',
                'template_public_id': self.template.public_id,
                'language': 'vi-VN',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        cv = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertEqual(cv.current_template_version_id, next_version.id)
        self.assertEqual(cv.latest_version.template_version_id, next_version.id)

    def test_create_blank_builds_usercv_initial_version_and_draft(self):
        response = self.client.post(
            reverse('cv-list-create'),
            {
                'title': 'Blank CV',
                'template_public_id': self.template.public_id,
                'language': 'vi-VN',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        cv = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertEqual(cv.user_id, self.candidate.id)
        # Exactly one immutable initial version.
        versions = CvVersion.objects.filter(cv=cv)
        self.assertEqual(versions.count(), 1)
        self.assertEqual(cv.latest_version.version_kind, CvVersion.VersionKind.INITIAL)
        self.assertEqual(cv.latest_version.template_version_id, self.template_version.id)
        # A mutable draft seeded from the initial document.
        self.assertTrue(CvDraft.objects.filter(cv=cv).exists())
        self.assertEqual(cv.draft.content_json, cv.latest_version.content_json)

    def test_create_from_position_resolves_generic_content_and_persists_taxonomy_identity(self):
        position = JobCategory.objects.create(name='Nhân viên CSKH')
        CvPositionProfile.objects.create(job_category=position)
        JobCategoryLocalization.objects.bulk_create(
            [
                JobCategoryLocalization(
                    category=position, locale='vi-VN', display_name='Nhân viên CSKH'
                ),
                JobCategoryLocalization(
                    category=position,
                    locale='en-US',
                    display_name='Customer Service Representative',
                ),
            ]
        )
        content = empty_content('en-US')
        content['personal_info']['headline'] = '{position}'
        content['sections'] = [
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': 'Career objective',
                'enabled': True,
                'items': [{'item_id': 'summary_item_1', 'value': 'Build a career as {position}.'}],
            }
        ]
        CvSampleContent.objects.update_or_create(
            position_profile=None,
            locale='en-US',
            experience_band='senior',
            defaults={
                'title': 'Generic',
                'content_json': content,
                'status': CvSampleContent.Status.PUBLISHED,
            },
        )

        response = self.client.post(
            reverse('cv-list-create'),
            {
                'title': 'Customer Service CV',
                'template_public_id': self.template.public_id,
                'language': 'en-US',
                'position_public_id': position.public_id,
                'experience_band': 'senior',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        cv = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertEqual(cv.position_id, position.id)
        self.assertEqual(response.data['position_public_id'], position.public_id)
        self.assertEqual(
            cv.draft.content_json['personal_info']['headline'], 'Customer Service Representative'
        )
        summary = next(
            section
            for section in cv.draft.content_json['sections']
            if section['section_key'] == 'summary'
        )
        self.assertEqual(
            summary['items'][0]['value'], 'Build a career as Customer Service Representative.'
        )

    def test_cv_quota_from_admin_setting_blocks_every_create_path(self):
        SiteSetting.objects.create(key='candidate_max_cvs', value=2)
        first = self.create_cv()
        self.create_cv()

        created = self.client.post(
            reverse('cv-list-create'),
            {'title': 'CV thứ ba', 'template_public_id': self.template.public_id},
            format='json',
        )
        uploaded = self.client.post(
            reverse('cv-import'),
            {'file': cv_pdf_upload()},
            format='multipart',
        )
        duplicated = self.client.post(
            reverse('cv-duplicate', kwargs={'public_id': first.public_id}), {}, format='json'
        )

        for response in (created, uploaded, duplicated):
            self.assertEqual(response.status_code, 409, response.data)
            self.assertEqual(response.data['code'], 'CV_LIMIT_REACHED')
            self.assertEqual(
                response.data['message'], 'Hiện tại tài khoản của bạn chỉ hỗ trợ tạo 2 CV!'
            )
        self.assertEqual(UserCv.objects.filter(user=self.candidate).count(), 2)

    def test_recruiter_search_opt_in_per_cv_requires_profile_consent(self):
        cv = self.import_uploaded_cv(cv_pdf_upload())
        url = reverse('cv-detail', kwargs={'public_id': cv.public_id})

        blocked = self.client.patch(url, {'recruiter_searchable': True}, format='json')
        CandidateConsent.objects.create(
            candidate_profile=CandidateProfile.objects.get_or_create(user=self.candidate)[0],
            consent_type=CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
            decision=CandidateConsent.Decision.GRANTED,
        )
        enabled = self.client.patch(url, {'recruiter_searchable': True}, format='json')
        disabled = self.client.patch(url, {'recruiter_searchable': False}, format='json')

        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(blocked.data['code'], 'RECRUITER_CONSENT_REQUIRED')
        self.assertTrue(enabled.data['recruiter_searchable'])
        self.assertFalse(disabled.data['recruiter_searchable'])

    def test_setting_another_default_cv_clears_the_previous_active_default(self):
        first_cv = self.create_cv()
        second_cv = self.create_cv()
        first = self.client.patch(
            reverse('cv-detail', kwargs={'public_id': first_cv.public_id}),
            {'is_default': True},
            format='json',
        )
        second = self.client.patch(
            reverse('cv-detail', kwargs={'public_id': second_cv.public_id}),
            {'is_default': True},
            format='json',
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        first_cv.refresh_from_db()
        second_cv.refresh_from_db()
        self.assertFalse(first_cv.is_default)
        self.assertTrue(second_cv.is_default)

    def test_duplicate_creates_an_independent_builder_draft_from_the_latest_version(self):
        source_cv = self.create_cv()
        source_draft = source_cv.draft
        source_draft.content_json['personal_info']['full_name'] = 'Original candidate'
        source_draft.save(update_fields=['content_json'])
        saved = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': source_cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        source_cv.refresh_from_db()

        response = self.client.post(
            reverse('cv-duplicate', kwargs={'public_id': source_cv.public_id}),
            {'title': 'CV duplicated'},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        duplicate = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertNotEqual(duplicate.pk, source_cv.pk)
        self.assertEqual(duplicate.title, 'CV duplicated')
        self.assertEqual(duplicate.lifecycle_status, UserCv.LifecycleStatus.DRAFT)
        self.assertEqual(duplicate.latest_version.version_kind, CvVersion.VersionKind.INITIAL)
        self.assertEqual(
            duplicate.current_template_version_id, source_cv.current_template_version_id
        )
        self.assertEqual(
            duplicate.draft.content_json['personal_info']['full_name'], 'Original candidate'
        )

        duplicate_draft = duplicate.draft
        duplicate_draft.content_json['personal_info']['full_name'] = 'Duplicate candidate'
        duplicate_draft.save(update_fields=['content_json'])
        source_cv.refresh_from_db()
        self.assertEqual(
            source_cv.draft.content_json['personal_info']['full_name'], 'Original candidate'
        )

    def test_delete_permanently_removes_the_cv_from_owner_library(self):
        cv = self.create_cv()
        self.assertEqual(
            self.client.delete(
                reverse('cv-detail', kwargs={'public_id': cv.public_id})
            ).status_code,
            204,
        )
        self.assertFalse(UserCv.objects.filter(pk=cv.pk).exists())
        listed = self.client.get(reverse('cv-list-create')).data
        self.assertEqual(listed['results'] if isinstance(listed, dict) else listed, [])

    def test_candidate_ownership_and_employer_access_are_enforced(self):
        cv = self.create_cv()
        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(self.draft_url(cv)).status_code, 404)
        self.assertEqual(
            self.client.get(
                reverse('cv-version-list', kwargs={'public_id': cv.public_id})
            ).status_code,
            404,
        )

        employer = get_user_model().objects.create_user(
            email='v2-employer@example.com',
            password='password',
            role='employer',
        )
        self.client.force_authenticate(employer)
        self.assertEqual(self.client.get(self.draft_url(cv)).status_code, 403)
        self.assertEqual(self.client.get(self.owner_view_url(cv)).status_code, 403)
        self.assertEqual(self.client.get(self.shared_links_url(cv)).status_code, 403)
