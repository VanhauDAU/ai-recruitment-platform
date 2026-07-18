from types import SimpleNamespace

from django.test import SimpleTestCase

from .completeness import COMPLETION_THRESHOLD, cv_completion_score


class CvCompletionScoreTests(SimpleTestCase):
    def cv(self, content, *, cv_type='builder', file_name=''):
        return SimpleNamespace(
            cv_type=cv_type,
            file_name=file_name,
            latest_version=SimpleNamespace(content_json=content),
        )

    def test_complete_saved_cv_reaches_the_application_threshold(self):
        content = {
            'personal_info': {
                'full_name': 'Nguyễn Văn A',
                'email': 'a@example.com',
                'phone': '0909000000',
                'headline': 'Frontend Developer',
                'address': 'Đà Nẵng',
            },
            'sections': [
                {'section_key': 'summary', 'items': [{'value': 'Mục tiêu nghề nghiệp'}]},
                {'section_key': 'experience', 'items': [{'company': 'ProCV'}]},
                {'section_key': 'education', 'items': [{'school': 'Đại học'}]},
                {'section_key': 'skills', 'items': [{'name': 'React'}]},
            ],
        }

        self.assertGreaterEqual(cv_completion_score(self.cv(content)), COMPLETION_THRESHOLD)

    def test_empty_saved_cv_is_incomplete(self):
        content = {'personal_info': {}, 'sections': []}

        self.assertEqual(cv_completion_score(self.cv(content)), 0)

    def test_uploaded_file_is_complete_as_a_document(self):
        self.assertEqual(cv_completion_score(self.cv({}, cv_type='uploaded', file_name='cv.pdf')), 100)
