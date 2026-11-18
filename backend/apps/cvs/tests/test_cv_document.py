import unicodedata
from io import BytesIO

from django.test import SimpleTestCase

from ..services.cv_document import (
    CvDocumentRejected,
    clean_document_text,
    heading_section,
    looks_like_cv,
    read_cv_document,
)
from .fixtures import docx_bytes, pdf_bytes


class CvRecognitionTests(SimpleTestCase):
    def test_recognises_vietnamese_cv_even_when_pdf_splits_words(self):
        text = 'Lê V ă n H ậ u\n0816548150\nMụ c tiêu ngh ề nghi ệ p\nKỹ  n ă ng\nH ọ c v ấ n'
        self.assertTrue(looks_like_cv(text))
        self.assertTrue(looks_like_cv('Jane Doe\njane@example.com\nEXPERIENCE\nEDUCATION'))

    def test_rejects_documents_without_contact_or_cv_sections(self):
        self.assertFalse(looks_like_cv('Hóa đơn bán hàng, kỹ năng phục vụ. Liên hệ 0912345678'))
        self.assertFalse(looks_like_cv('Kinh nghiệm làm việc\nHọc vấn\nKỹ năng'))
        report = (
            'BÁO CÁO THỰC TẬP\nSinh viên: An - an@dut.udn.vn\nChương 1. Tổng quan\n'
            'Em đã tích lũy kinh nghiệm làm việc nhóm, kỹ năng giao tiếp và học vấn qua dự án.'
        )
        self.assertFalse(looks_like_cv(report))

    def test_reads_real_pdf_and_docx_and_rewinds_the_source(self):
        for content, file_type in ((pdf_bytes(), 'pdf'), (docx_bytes(), 'docx')):
            source = BytesIO(content)
            self.assertIn('an.nguyen@example.com', read_cv_document(source, file_type))
            self.assertEqual(source.tell(), 0)

    def test_rejection_codes_for_scans_and_non_cv_files(self):
        cases = (
            (pdf_bytes(('Scan',)), 'scanned_pdf_ocr_unavailable'),
            (
                pdf_bytes(('Bien ban hop phong ban thang 10 nam 2026, noi dung tong ket.',)),
                'not_a_cv',
            ),
            (b'%PDF-1.4 broken', 'text_extraction_failed'),
        )
        for content, code in cases:
            with self.subTest(code=code), self.assertRaises(CvDocumentRejected) as raised:
                read_cv_document(BytesIO(content), 'pdf')
            self.assertEqual(raised.exception.code, code)


class CvTextHelpersTests(SimpleTestCase):
    def test_clean_text_is_nfc_and_keeps_icon_gaps_as_spaces(self):
        decomposed = unicodedata.normalize('NFD', 'Ứng viên')
        self.assertEqual(
            clean_document_text(f'{decomposed}\r\nSep 2020Jun 2021'), 'Ứng viên\nSep 2020 Jun 2021'
        )

    def test_heading_section_names_cv_sections_only(self):
        self.assertEqual(heading_section('KINH NGHIỆM LÀM VIỆC'), 'experience')
        self.assertEqual(heading_section('Technical Skills'), 'skills')
        self.assertEqual(heading_section('Trình độ ngoại ngữ'), 'languages')
        self.assertIsNone(heading_section('Nhóm Phát triển SoftSkills'))
        self.assertIsNone(heading_section('Lập báo cáo tài chính hằng tháng'))
