from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.cv_templates.models import CvSampleContent, CvTemplate, CvTemplateVersion

from .models import CvVersion, UserCv
from .schemas import empty_content, empty_layout, empty_style
from .services.versions import sync_legacy_builder_draft


class CvV2ApiTests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='v2-candidate@example.com', password='password', role='candidate', email_verified=True,
        )
        self.other_candidate = get_user_model().objects.create_user(
            email='v2-other@example.com', password='password', role='candidate', email_verified=True,
        )
        self.template = CvTemplate.objects.create(
            name='V2 Template', lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        )
        self.template_version = CvTemplateVersion.objects.create(
            template=self.template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='classic_single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
            content_contract={'schema': 'canonical_cv_content_v1', 'schema_version': 1},
        )
        self.template.current_published_version = self.template_version
        self.template.save(update_fields=['current_published_version'])
        self.client.force_authenticate(self.candidate)

    def create_cv(self):
        response = self.client.post(
            reverse('cv-v2-list-create'),
            {'title': 'CV V2', 'template_public_id': self.template.public_id, 'language': 'vi-VN'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        return UserCv.objects.get(public_id=response.data['public_id'])

    def draft_url(self, cv):
        return reverse('cv-v2-draft', kwargs={'public_id': cv.public_id})

    def test_create_autosave_save_and_publish_follow_the_lifecycle_contract(self):
        cv = self.create_cv()
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)

        draft_response = self.client.get(self.draft_url(cv))
        self.assertEqual(draft_response.status_code, 200)
        self.assertEqual(draft_response['ETag'], '"lock-version-0"')
        payload = {
            key: draft_response.data[key]
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['content_json']['personal_info']['full_name'] = 'Candidate V2'

        autosave = self.client.put(
            self.draft_url(cv), payload, format='json', HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(autosave.status_code, 200, autosave.data)
        self.assertEqual(autosave.data['lock_version'], 1)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)
        cv.refresh_from_db()
        self.assertEqual(cv.cv_data['personal_info']['full_name'], 'Candidate V2')

        stale = self.client.put(
            self.draft_url(cv), payload, format='json', HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data['current_lock_version'], 1)

        saved = self.client.post(
            reverse('cv-v2-save-version', kwargs={'public_id': cv.public_id}),
            format='json', HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['version_kind'], CvVersion.VersionKind.MANUAL_SAVE)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 2)

        published = self.client.post(
            reverse('cv-v2-publish', kwargs={'public_id': cv.public_id}),
            format='json', HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(published.status_code, 201, published.data)
        self.assertEqual(published.data['version_kind'], CvVersion.VersionKind.PUBLISHED)
        cv.refresh_from_db()
        self.assertEqual(cv.lifecycle_status, UserCv.LifecycleStatus.PUBLISHED)
        self.assertEqual(cv.published_version.public_id, published.data['public_id'])

    def test_autosave_rejects_invalid_canonical_documents_before_writing(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        payload = {
            key: draft[key]
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['style_json']['theme_color'] = 'not-a-color'

        response = self.client.put(
            self.draft_url(cv), payload, format='json', HTTP_IF_MATCH='"lock-version-0"',
        )

        self.assertEqual(response.status_code, 400)
        cv.refresh_from_db()
        self.assertEqual(cv.draft.lock_version, 0)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)

    def test_candidate_ownership_and_employer_access_are_enforced(self):
        cv = self.create_cv()
        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(self.draft_url(cv)).status_code, 404)
        self.assertEqual(
            self.client.get(reverse('cv-v2-version-list', kwargs={'public_id': cv.public_id})).status_code,
            404,
        )

        employer = get_user_model().objects.create_user(
            email='v2-employer@example.com', password='password', role='employer',
        )
        self.client.force_authenticate(employer)
        self.assertEqual(self.client.get(self.draft_url(cv)).status_code, 403)

    def test_saved_versions_are_read_only_and_save_rolls_back_if_version_insert_fails(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        response = self.client.patch(
            reverse('cv-v2-version-detail', kwargs={
                'public_id': cv.public_id,
                'version_public_id': cv.latest_version.public_id,
            }),
            {'plain_text': 'attempted mutation'}, format='json',
        )
        self.assertEqual(response.status_code, 405)

        with patch('apps.cvs.services.versions.CvVersion.save', side_effect=RuntimeError('database failure')):
            with self.assertRaisesRegex(RuntimeError, 'database failure'):
                self.client.post(
                    reverse('cv-v2-save-version', kwargs={'public_id': cv.public_id}),
                    format='json', HTTP_IF_MATCH=f'"lock-version-{draft["lock_version"]}"',
                )
        cv.refresh_from_db()
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)
        self.assertEqual(cv.latest_version.version_kind, CvVersion.VersionKind.INITIAL)

    def test_creation_requires_verified_email_and_a_published_template_version(self):
        unverified = get_user_model().objects.create_user(
            email='v2-unverified@example.com', password='password', role='candidate', email_verified=False,
        )
        self.client.force_authenticate(unverified)
        response = self.client.post(
            reverse('cv-v2-list-create'),
            {'title': 'Blocked', 'template_public_id': self.template.public_id}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(self.candidate)
        self.template.current_published_version = None
        self.template.save(update_fields=['current_published_version'])
        response = self.client.post(
            reverse('cv-v2-list-create'),
            {'title': 'No release', 'template_public_id': self.template.public_id}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_creation_from_sample_pins_the_current_published_template_version(self):
        sample_content = empty_content('vi-VN')
        sample_content['personal_info']['full_name'] = 'Sample Candidate'
        sample = CvSampleContent.objects.create(
            locale='vi-VN',
            title='Sample content',
            content_json=sample_content,
            status=CvSampleContent.Status.PUBLISHED,
        )
        next_version = CvTemplateVersion.objects.create(
            template=self.template,
            version_number=2,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='classic_single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
        )
        self.template.current_published_version = next_version
        self.template.save(update_fields=['current_published_version'])

        response = self.client.post(
            reverse('cv-v2-list-create'),
            {
                'title': 'Sample CV',
                'template_public_id': self.template.public_id,
                'language': 'vi-VN',
                'sample_content_public_id': sample.public_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        cv = UserCv.objects.get(public_id=response.data['public_id'])
        self.assertEqual(cv.current_template_version_id, next_version.id)
        self.assertEqual(cv.draft.content_json['personal_info']['full_name'], 'Sample Candidate')
        self.assertEqual(cv.latest_version.template_version_id, next_version.id)

    def test_legacy_dual_write_does_not_discard_a_v2_layout(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        payload = {
            key: draft[key]
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['layout_json']['page']['margin_mm'] = 16
        self.client.put(self.draft_url(cv), payload, format='json', HTTP_IF_MATCH='"lock-version-0"')

        cv.refresh_from_db()
        cv.title = 'Changed through legacy metadata flow'
        cv.save(update_fields=['title'])
        sync_legacy_builder_draft(cv, self.candidate)

        self.assertEqual(cv.draft.layout_json['page']['margin_mm'], 16)
