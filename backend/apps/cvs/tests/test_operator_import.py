"""Nhập CV dựng sẵn: mỗi CV một tài khoản ứng viên thử, chạy thử không ghi, chạy lại bỏ qua."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.cv_templates.tests.factories import make_published_template

from ..models import CvSkill, UserCv
from ..services import create_pdf_twins, import_cv_documents
from ..services.operator_import import SYNTHETIC_EMAIL_DOMAIN

GENERATED = {
    'headline': 'Backend Developer',
    'summary': 'Ba năm phát triển dịch vụ backend.',
    'experience': [
        {
            'role': 'Backend Developer',
            'company': 'Công ty TNHH Ví Dụ',
            'start_date': '2023-11',
            'end_date': None,
            'highlights': ['Xây dựng API bằng Django', 'Tối ưu truy vấn PostgreSQL'],
        }
    ],
    'education': {
        'degree': 'Kỹ sư Công nghệ thông tin',
        'institution': 'Đại học Ví Dụ',
        'degree_level': 'university',
        'start_date': '2019-09',
        'end_date': '2023-06',
    },
    'skills': [{'name': 'Python', 'level': 4}],
    'projects': [{'name': 'Hệ thống đặt hàng', 'role': 'Backend', 'highlights': ['Thiết kế API']}],
    'certifications': [],
    'languages': [{'language': 'Tiếng Anh', 'level': 'Làm việc', 'certificate': 'IELTS 6.5'}],
    'activities': [
        {'name': 'Tình nguyện', 'organization': 'CLB Ví Dụ', 'highlights': ['Dạy tin học']}
    ],
    'awards': [],
    'interests': ['Đọc sách'],
}


class ImportCvDocumentsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        make_published_template('Operator template')

    def test_apply_creates_one_candidate_and_one_versioned_cv_per_code(self):
        report = import_cv_documents(
            [{'code': 'CV-001', 'language': 'vi', 'data': GENERATED}], apply=True
        )

        self.assertEqual(report['summary'], {'imported': 1, 'skipped': 0, 'error': 0})
        owner = get_user_model().objects.get(email=f'cv-001@{SYNTHETIC_EMAIL_DOMAIN}')
        self.assertEqual(owner.role, 'candidate')
        self.assertFalse(owner.has_usable_password())
        cv = UserCv.objects.get(user=owner)
        self.assertTrue(cv.title.startswith('CV-001'))
        content = cv.latest_version.content_json
        self.assertEqual(content['personal_info']['email'], '')
        keys = [section['section_key'] for section in content['sections']]
        self.assertTrue({'summary', 'experience', 'education', 'skills', 'projects'} <= set(keys))
        self.assertNotIn('certifications', keys)
        self.assertNotIn('awards', keys)
        languages = next(s for s in content['sections'] if s['section_key'] == 'languages')
        self.assertEqual(
            (languages['title'], languages['items'][0]['name'], languages['items'][0]['value']),
            ('Ngoại ngữ', 'Tiếng Anh', 'Làm việc · IELTS 6.5'),
        )
        self.assertTrue({'activities', 'interests'} <= set(keys))
        # Hồ sơ đối sánh hiện có đọc được kinh nghiệm, bậc học và kỹ năng của CV.
        self.assertEqual(cv.education_level, 'university')
        self.assertNotEqual(cv.experience_years, 'none')
        self.assertIn('Django', cv.latest_version.plain_text)
        # Python không có trong danh mục kỹ năng của DB test nên không sinh CvSkill.
        self.assertFalse(CvSkill.objects.filter(cv=cv).exists())

    def test_dry_run_writes_nothing_and_rerun_skips(self):
        item = {'code': 'CV-002', 'language': 'en', 'data': GENERATED}

        dry = import_cv_documents([item], apply=False)
        self.assertEqual(dry['summary']['imported'], 1)
        self.assertFalse(UserCv.objects.exists())

        import_cv_documents([item], apply=True)
        rerun = import_cv_documents([item], apply=True)
        self.assertEqual(rerun['summary'], {'imported': 0, 'skipped': 1, 'error': 0})
        self.assertEqual(UserCv.objects.count(), 1)
        self.assertEqual(UserCv.objects.get().language, 'en-US')

    def test_invalid_rows_are_reported_without_stopping_the_batch(self):
        report = import_cv_documents(
            [
                {'code': 'abc', 'language': 'vi', 'data': GENERATED},
                {'code': 'CV-003', 'language': 'fr', 'data': GENERATED},
                {'code': 'CV-004', 'language': 'vi', 'data': GENERATED},
            ],
            apply=True,
        )

        self.assertEqual([row['status'] for row in report['rows']], ['error', 'error', 'imported'])
        self.assertIn('Mã CV', report['rows'][0]['error'])
        self.assertIn('vi hoặc en', report['rows'][1]['error'])

    @patch('apps.cvs.services.operator_import.render_document_pdf', return_value=b'%PDF-1.4 fake')
    @patch('apps.cvs.services.cvs.read_cv_document')
    def test_pdf_twin_uploads_rendered_pdf_with_synthetic_email(self, _read, render):
        import_cv_documents([{'code': 'CV-005', 'language': 'en', 'data': GENERATED}], apply=True)

        report, pdfs = create_pdf_twins(['CV-005', 'CV-999'], apply=True)

        self.assertEqual([row['status'] for row in report['rows']], ['imported', 'error'])
        personal_info = render.call_args.args[0]['document']['content_json']['personal_info']
        self.assertEqual(personal_info['email'], f'cv-005@{SYNTHETIC_EMAIL_DOMAIN}')
        twin = UserCv.objects.get(cv_type=UserCv.CvType.UPLOADED)
        self.assertEqual(
            (twin.title, twin.file_type, twin.language), ('CV-005 PDF', 'pdf', 'en-US')
        )
        self.assertEqual(pdfs, {'CV-005': b'%PDF-1.4 fake'})
        builder = UserCv.objects.get(cv_type=UserCv.CvType.BUILDER)
        self.assertEqual(builder.latest_version.content_json['personal_info']['email'], '')
        rerun, _ = create_pdf_twins(['CV-005'], apply=True)
        self.assertEqual(rerun['summary']['skipped'], 1)
