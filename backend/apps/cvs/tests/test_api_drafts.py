"""The autosave draft: validation, optimistic locking, template switch/preview and samples."""

from copy import deepcopy
from unittest.mock import patch

from django.urls import reverse

from apps.cv_templates.models import CvSampleContent, empty_content, empty_style
from apps.cv_templates.services import compose_cv_document
from apps.cvs.models import CvDraft, CvVersion

from .api_case import CvApiTestCase


class CvDraftApiTests(CvApiTestCase):
    def test_canonical_composer_applies_presentation_without_mutating_content(self):
        content = empty_content('vi-VN')
        original = deepcopy(content)

        document = compose_cv_document(
            template=self.template,
            content_json=content,
            theme_color='#2255AA',
        )

        self.assertEqual(content, original)
        self.assertIsNot(document['content_json'], content)
        self.assertEqual(document['style_json']['theme_color'], '#2255AA')
        self.assertEqual(document['schema_version'], self.template_version.schema_version)

    def test_template_preview_projects_draft_without_mutating_cv(self):
        cv = self.create_cv()
        original_template_id = cv.template_id
        alternate, version = self.create_alternate_template()

        response = self.client.get(
            reverse('cv-template-preview', kwargs={'public_id': cv.public_id}),
            {'template_public_id': alternate.public_id},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['renderer']['key'], version.renderer_key)
        cv.refresh_from_db()
        self.assertEqual(cv.template_id, original_template_id)

    def test_autosave_rejects_invalid_canonical_documents_before_writing(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        payload = {
            key: draft[key]
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['style_json']['theme_color'] = 'not-a-color'

        response = self.client.put(
            self.draft_url(cv),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )

        self.assertEqual(response.status_code, 400)
        cv.refresh_from_db()
        self.assertEqual(cv.draft.lock_version, 0)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)

    def test_autosave_accepts_only_the_bundled_font_families(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        payload = {
            key: deepcopy(draft[key])
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['style_json']['font_family'] = 'Arial'

        response = self.client.put(
            self.draft_url(cv), payload, format='json', HTTP_IF_MATCH='"lock-version-0"'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('style_json.font_family', response.data)

    def test_save_and_publish_validate_the_draft_before_creating_a_version(self):
        cv = self.create_cv()
        CvDraft.objects.filter(cv=cv).update(style_json={**empty_style(), 'theme_color': 'invalid'})

        save = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        publish = self.client.post(
            reverse('cv-publish', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )

        self.assertEqual(save.status_code, 400)
        self.assertEqual(publish.status_code, 400)
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)

    def test_saved_versions_are_read_only_and_save_rolls_back_if_version_insert_fails(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        response = self.client.patch(
            reverse(
                'cv-version-detail',
                kwargs={
                    'public_id': cv.public_id,
                    'version_public_id': cv.latest_version.public_id,
                },
            ),
            {'plain_text': 'attempted mutation'},
            format='json',
        )
        self.assertEqual(response.status_code, 405)

        with patch(
            'apps.cvs.services.versions.CvVersion.save',
            side_effect=RuntimeError('database failure'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'database failure'):
                self.client.post(
                    reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
                    format='json',
                    HTTP_IF_MATCH=f'"lock-version-{draft["lock_version"]}"',
                )
        cv.refresh_from_db()
        self.assertEqual(CvVersion.objects.filter(cv=cv).count(), 1)
        self.assertEqual(cv.latest_version.version_kind, CvVersion.VersionKind.INITIAL)

    def test_template_switch_preserves_content_and_changes_only_mutable_presentation(self):
        cv = self.create_cv()
        alternate_template, alternate_version = self.create_alternate_template()
        original_version = cv.latest_version
        original_content = deepcopy(cv.draft.content_json)

        response = self.client.put(
            reverse('cv-template-switch', kwargs={'public_id': cv.public_id}),
            {'template_public_id': alternate_template.public_id, 'client_session_id': 'editor-tab'},
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response['ETag'], '"lock-version-1"')
        self.assertEqual(response.data['draft']['content_json'], original_content)
        self.assertEqual(response.data['cv']['template_renderer_key'], 'sidebar_right_v1')
        self.assertEqual(
            response.data['cv']['template_capabilities']['layout']['column_resize']['min_percent'],
            25,
        )
        self.assertEqual(response.data['draft']['layout_json']['regions'][1]['id'], 'sidebar')
        self.assertEqual(response.data['draft']['style_json']['theme_color'], '#2255AA')
        cv.refresh_from_db()
        self.assertEqual(cv.template_id, alternate_template.id)
        self.assertEqual(cv.current_template_version_id, alternate_version.id)
        self.assertEqual(cv.latest_version_id, original_version.id)

        invalid_layout = {
            key: deepcopy(response.data['draft'][key])
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        invalid_layout['layout_json']['regions'][0]['width_percent'] = 90
        invalid_layout['layout_json']['regions'][1]['width_percent'] = 10
        invalid_resize = self.client.put(
            self.draft_url(cv),
            invalid_layout,
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(invalid_resize.status_code, 400)
        self.assertIn('layout_json.regions', invalid_resize.data)

        stale = self.client.put(
            reverse('cv-template-switch', kwargs={'public_id': cv.public_id}),
            {'template_public_id': self.template.public_id},
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(stale.status_code, 409)

    def test_layout_item_order_is_validated_and_autosave_keeps_canonical_item_data(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        payload = {
            key: deepcopy(draft[key])
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        payload['content_json']['sections'] = [
            {
                'instance_id': 'experience_1',
                'section_key': 'experience',
                'title': 'Kinh nghiệm',
                'enabled': True,
                'items': [
                    {
                        'item_id': 'experience_item_1',
                        'role': 'First',
                        'company': '',
                        'start_date': None,
                        'end_date': None,
                    },
                    {
                        'item_id': 'experience_item_2',
                        'role': 'Second',
                        'company': '',
                        'start_date': None,
                        'end_date': None,
                    },
                ],
            }
        ]
        payload['layout_json']['regions'][0]['section_instance_ids'] = ['experience_1']
        payload['layout_json']['item_orders'] = {
            'experience_1': ['experience_item_2', 'experience_item_1'],
        }
        original_content = deepcopy(payload['content_json'])

        autosave = self.client.put(
            self.draft_url(cv),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )

        self.assertEqual(autosave.status_code, 200, autosave.data)
        self.assertEqual(autosave.data['content_json'], original_content)
        self.assertEqual(
            autosave.data['layout_json']['item_orders']['experience_1'],
            ['experience_item_2', 'experience_item_1'],
        )

        payload['layout_json']['item_orders']['experience_1'] = ['experience_item_1']
        invalid = self.client.put(
            self.draft_url(cv),
            payload,
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(invalid.status_code, 400)

    def test_apply_sample_uses_cas_and_preserves_personal_info_and_style(self):
        cv = self.create_cv()
        cv.draft.content_json['personal_info']['full_name'] = 'Tên ứng viên thật'
        cv.draft.style_json['theme_color'] = '#2255AA'
        cv.draft.save(update_fields=['content_json', 'style_json'])
        sample_content = empty_content('vi-VN')
        sample_content['personal_info']['full_name'] = 'Tên demo không được ghi đè'
        sample_content['sections'] = [
            {
                'instance_id': 'sample_summary_1',
                'section_key': 'summary',
                'title': 'Giới thiệu',
                'enabled': True,
                'items': [{'item_id': 'sample_summary_item_1', 'value': 'Nội dung mẫu'}],
            }
        ]
        sample = CvSampleContent.objects.create(
            position_profile=self.curated_sample_profile(),
            experience_band='mid',
            locale='vi-VN',
            title='Sample apply',
            content_json=sample_content,
            status=CvSampleContent.Status.PUBLISHED,
        )
        url = reverse('cv-apply-sample', kwargs={'public_id': cv.public_id})

        applied = self.client.post(
            url,
            {'sample_content_public_id': sample.public_id},
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )

        self.assertEqual(applied.status_code, 200, applied.data)
        self.assertEqual(applied.data['lock_version'], 1)
        self.assertEqual(
            applied.data['content_json']['personal_info']['full_name'], 'Tên ứng viên thật'
        )
        self.assertEqual(
            applied.data['content_json']['sections'][0]['items'][0]['value'], 'Nội dung mẫu'
        )
        self.assertEqual(applied.data['style_json']['theme_color'], '#2255AA')
        stale = self.client.post(
            url,
            {'sample_content_public_id': sample.public_id},
            format='json',
            HTTP_IF_MATCH='"lock-version-0"',
        )
        self.assertEqual(stale.status_code, 409)
