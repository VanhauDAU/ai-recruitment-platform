import tempfile

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from apps.cvs.models import CvVersion, ImmutableCvVersionError, UserCv
from apps.cvs.schemas import (
    canonicalize_legacy_cv_data,
    empty_content,
    empty_layout,
    empty_style,
    validate_cv_document,
)
from apps.cvs.services.versions import (
    StaleDraftError,
    create_application_snapshot,
    create_initial_document,
    update_draft,
)

TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CanonicalCvDocumentTests(TestCase):
    def valid_document(self):
        content = empty_content()
        content['sections'] = [
            {
                'instance_id': 'sec_experience_1',
                'section_key': 'experience',
                'title': 'Experience',
                'enabled': True,
                'items': [
                    {
                        'item_id': 'experience_1',
                        'company': 'Acme',
                        'start_date': '2025-01',
                        'end_date': None,
                        'description': {
                            'format': 'rich_text_v1',
                            'content': [{'type': 'bullet', 'text': 'Built a safe CV contract.'}],
                        },
                    }
                ],
            }
        ]
        layout = empty_layout()
        layout['regions'][0]['section_instance_ids'] = ['sec_experience_1']
        return content, layout, empty_style()

    def test_accepts_canonical_document(self):
        content, layout, style = self.valid_document()

        validate_cv_document(
            content_json=content, layout_json=layout, style_json=style, schema_version=1
        )

    def test_legacy_payload_is_adapted_to_the_canonical_three_document_contract(self):
        content, layout, style = canonicalize_legacy_cv_data(
            {
                'personal': {'full_name': 'Nguyễn Văn A'},
                'skills': [{'name': 'Django'}],
            },
            {'color': '#00A66A', 'font_family': 'Roboto'},
        )

        self.assertEqual(content['personal_info']['full_name'], 'Nguyễn Văn A')
        self.assertEqual(content['sections'][0]['items'][0]['item_id'], 'legacy_skills_1')
        validate_cv_document(
            content_json=content, layout_json=layout, style_json=style, schema_version=1
        )

    def test_rejects_unknown_section_duplicate_ids_and_unsafe_html(self):
        content, layout, style = self.valid_document()
        content['sections'][0]['section_key'] = 'template_specific_magic'
        content['sections'][0]['items'][0]['description']['content'][0]['text'] = (
            '<script>alert(1)</script>'
        )
        content['sections'].append(
            {
                **content['sections'][0],
                'instance_id': 'sec_experience_1',
            }
        )

        with self.assertRaises(ValidationError) as context:
            validate_cv_document(
                content_json=content, layout_json=layout, style_json=style, schema_version=1
            )

        self.assertIn('content_json.sections[0].section_key', context.exception.message_dict)
        self.assertIn('content_json.sections[1].instance_id', context.exception.message_dict)

    def test_accepts_rich_text_v2_rows_and_hidden_sections(self):
        content, layout, style = self.valid_document()
        content['sections'][0]['items'][0]['description'] = {
            'format': 'rich_text_v2',
            'content': [
                {
                    'type': 'bullet',
                    'text': 'Thiết kế API an toàn',
                    'runs': [
                        {'text': 'Thiết kế API', 'marks': {'bold': True, 'color': '#0066AA'}},
                        {'text': ' an toàn', 'marks': {'italic': True, 'font_size_pt': 11}},
                    ],
                }
            ],
        }
        content['sections'].append(
            {
                'instance_id': 'sec_interests_1',
                'section_key': 'interests',
                'title': 'Sở thích',
                'enabled': True,
                'items': [{'item_id': 'interests_1', 'value': 'Đọc sách'}],
            }
        )
        layout['regions'] = [
            {'id': 'header', 'row': 0, 'width_percent': 100, 'section_instance_ids': []},
            {
                'id': 'main',
                'row': 1,
                'width_percent': 60,
                'section_instance_ids': ['sec_experience_1'],
            },
            {'id': 'sidebar', 'row': 1, 'width_percent': 40, 'section_instance_ids': []},
        ]
        layout['hidden_section_instance_ids'] = ['sec_interests_1']

        validate_cv_document(
            content_json=content, layout_json=layout, style_json=style, schema_version=1
        )

    def test_rejects_invalid_rich_text_marks_row_width_and_hidden_assignment(self):
        content, layout, style = self.valid_document()
        content['sections'][0]['items'][0]['description'] = {
            'format': 'rich_text_v2',
            'content': [
                {
                    'type': 'paragraph',
                    'text': 'Sai',
                    'runs': [{'text': 'Sai', 'marks': {'font_size_pt': 64, 'color': 'red'}}],
                }
            ],
        }
        layout['regions'] = [
            {
                'id': 'main',
                'row': 1,
                'width_percent': 70,
                'section_instance_ids': ['sec_experience_1'],
            },
            {'id': 'sidebar', 'row': 1, 'width_percent': 20, 'section_instance_ids': []},
        ]
        layout['hidden_section_instance_ids'] = ['sec_experience_1']

        with self.assertRaises(ValidationError) as context:
            validate_cv_document(
                content_json=content, layout_json=layout, style_json=style, schema_version=1
            )

        self.assertIn(
            'content_json.sections[0].items[0].description.content', context.exception.message_dict
        )
        self.assertIn('layout_json.regions', context.exception.message_dict)
        self.assertIn('layout_json.hidden_section_instance_ids', context.exception.message_dict)


class CvVersioningServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='versioned-candidate@example.com',
            password='password',
            role='candidate',
        )
        self.cv = UserCv.objects.create(
            user=self.user,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='Versioned CV',
        )

    def test_initial_version_and_draft_are_created_then_snapshot_stays_immutable(self):
        initial = create_initial_document(self.cv, self.user)
        snapshot = create_application_snapshot(self.cv, self.user)

        self.cv.refresh_from_db()
        self.assertEqual(initial.version_kind, CvVersion.VersionKind.INITIAL)
        self.assertEqual(snapshot.version_kind, CvVersion.VersionKind.APPLICATION_SNAPSHOT)
        self.assertEqual(snapshot.parent_version_id, initial.id)
        self.assertEqual(self.cv.latest_version_id, initial.id)
        self.assertEqual(self.cv.draft.base_version_id, initial.id)

        snapshot.plain_text = 'mutated'
        with self.assertRaises(ImmutableCvVersionError):
            snapshot.save()

    def test_draft_compare_and_swap_rejects_a_stale_write(self):
        create_initial_document(self.cv, self.user)
        self.cv.refresh_from_db()
        draft = self.cv.draft

        updated = update_draft(
            cv=self.cv,
            actor=self.user,
            content_json=draft.content_json,
            layout_json=draft.layout_json,
            style_json=draft.style_json,
            expected_lock_version=0,
        )
        self.assertEqual(updated.lock_version, 1)
        with self.assertRaises(StaleDraftError):
            update_draft(
                cv=self.cv,
                actor=self.user,
                content_json=draft.content_json,
                layout_json=draft.layout_json,
                style_json=draft.style_json,
                expected_lock_version=0,
            )


# Create your tests here.
