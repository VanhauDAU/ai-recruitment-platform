import datetime
import json

from django.test import SimpleTestCase

from ..services.extraction import ExtractionError, cv_profile, facts, text_cv_profile
from ..services.extraction.cv_upload import _declared_names, read_layout
from ..services.extraction.job import _is_subheading
from ..services.extraction.text import detect_language, reflow_lines, split_sentences
from .profile_schema import schema_errors
from .test_skills import catalog

TODAY = datetime.date(2026, 11, 18)
NOW = 2026 * 12 + 11 - 1


def rich(*lines):
    return {
        'format': 'rich_text_v1',
        'content': [{'type': 'bullet', 'text': line} for line in lines],
    }


def section(key, *items):
    return {'section_key': key, 'enabled': True, 'items': list(items)}


def builder_document(*sections, locale='vi-VN', headline='Frontend Developer'):
    return {
        'schema_version': 1,
        'locale': locale,
        'personal_info': {'headline': headline, 'email': 'an@example.com'},
        'sections': list(sections),
    }


class TextTests(SimpleTestCase):
    def test_sentences_drop_bullets_and_one_word_lines(self):
        self.assertEqual(
            split_sentences('- Viết API. Tối ưu truy vấn\n• ReactJS\n1) Dẫn dắt nhóm 3 người'),
            ['Viết API.', 'Tối ưu truy vấn', 'Dẫn dắt nhóm 3 người'],
        )

    def test_inline_bullets_split_a_long_line(self):
        self.assertEqual(
            split_sentences('Kế toán - Lập báo cáo thuế - Đối chiếu công nợ'),
            ['Kế toán', 'Lập báo cáo thuế', 'Đối chiếu công nợ'],
        )

    def test_reflow_joins_lines_broken_mid_sentence(self):
        self.assertEqual(
            reflow_lines(['Phát triển giao diện và', 'tăng tốc độ tải trang.', 'Viết test']),
            ['Phát triển giao diện và tăng tốc độ tải trang.', 'Viết test'],
        )

    def test_a_date_line_ending_with_hien_tai_is_complete(self):
        lines = ['Công ty B 03/2022 - Hiện tại', 'Kế toán viên']
        self.assertEqual(reflow_lines(lines), lines)

    def test_a_line_starting_with_a_date_is_not_a_continuation(self):
        self.assertEqual(
            reflow_lines(['02/2024', '- 08/2024', '09/2024', 'Giảm lỗi còn', '5 lỗi mỗi tháng.']),
            ['02/2024', '- 08/2024', '09/2024', 'Giảm lỗi còn 5 lỗi mỗi tháng.'],
        )

    def test_language_detection(self):
        self.assertEqual(detect_language('Phát triển phần mềm quản lý kho'), 'vi')
        self.assertEqual(detect_language('Built REST APIs for payments'), 'en')
        self.assertEqual(detect_language('2024 - 2025'), '')

    def test_english_text_with_a_few_vietnamese_names_is_english(self):
        english = (
            'Backend developer with five years of experience building payment services, '
            'leading a small team and improving reliability across several releases. '
            'Worked at Công ty Hà Nội and graduated from Đại học Bách Khoa.'
        )
        self.assertEqual(detect_language(english), 'en')
        # Chữ có dấu của tiếng khác không làm văn bản thành tiếng Việt.
        self.assertEqual(detect_language('Español señor niño über größe 日本語'), 'en')

    def test_job_listing_lines_are_not_subheadings(self):
        self.assertTrue(_is_subheading('Required Skills'))
        self.assertTrue(_is_subheading('Kinh nghiệm:'))
        self.assertFalse(_is_subheading('ReactJS, TypeScript, Redux'))
        self.assertFalse(_is_subheading('Thành thạo Excel và Word.'))


class FactsTests(SimpleTestCase):
    def test_date_ranges_in_common_cv_formats(self):
        cases = {
            '03/2021 - 06/2022': [(2021 * 12 + 2, 2022 * 12 + 5)],
            '2021-09 – 2025-06': [(2021 * 12 + 8, 2025 * 12 + 5)],
            'FPT (Sep 2020 > Jun 2021)': [(2020 * 12 + 8, 2021 * 12 + 5)],
            'Oct 2025   Present': [(2025 * 12 + 9, NOW)],
            'Công ty A 04/2026 - Hiện tại': [(2026 * 12 + 3, NOW)],
            # Dấu nối viết liền hoặc lặp lại.
            'Công ty B    04/2023-12/2024': [(2023 * 12 + 3, 2024 * 12 + 11)],
            'Dec 2024 >> Mar 2026': [(2024 * 12 + 11, 2026 * 12 + 2)],
            # Cách ghi tháng của tiếng Việt.
            'Tháng 9 năm 2021 - tháng 3 năm 2022': [(2021 * 12 + 8, 2022 * 12 + 2)],
            'T9/2021 - T3/2022': [(2021 * 12 + 8, 2022 * 12 + 2)],
            # Chỉ ghi năm: từ giữa năm này tới giữa năm kia, ít nhất nửa năm.
            '2019 - 2020': [(2019 * 12 + 6, 2020 * 12 + 5)],
            '2020 - 2020': [(2020 * 12 + 6, 2020 * 12 + 11)],
            # Hai năm đứng cạnh nhau không có dấu nối không phải một khoảng.
            'IELTS 2019 2021': [],
            'Hotline 0123 456 789': [],
        }
        for line, expected in cases.items():
            with self.subTest(line=line):
                self.assertEqual(facts.date_ranges(line, NOW), expected)
        self.assertEqual(facts.open_start_date('2026-03'), 2026 * 12 + 2)
        self.assertIsNone(facts.open_start_date('Từ 2026-03'))

    def test_date_range_printed_on_two_lines(self):
        # Mẫu CV hai cột in mốc đầu và mốc cuối chồng lên nhau bên lề.
        lines = ['11/2023', '11/2024', 'CÔNG TY A', '12/2024 CÔNG TY B', 'Hiện tại Manual Tester']
        self.assertEqual(facts.stacked_range(lines, 0, NOW), ((2023 * 12 + 10, 2024 * 12 + 10), 1))
        self.assertEqual(facts.stacked_range(lines, 3, NOW), ((2024 * 12 + 11, NOW), 4))
        self.assertEqual(
            facts.stacked_range(['02/2024', '- 08/2024'], 0, NOW),
            ((2024 * 12 + 1, 2024 * 12 + 7), 1),
        )
        # Dòng dưới không phải một mốc thời gian đứng riêng thì không ghép.
        self.assertIsNone(facts.stacked_range(['2026-03', 'Kế toán viên', 'Công ty C'], 0, NOW))

    def test_degree_words_win_over_institution_names(self):
        self.assertEqual(facts.education_level('Cao đẳng Kế toán — Trường Đại học X'), 'college')
        self.assertEqual(facts.education_level('National University of Economics'), 'university')
        self.assertEqual(facts.education_level('Thạc sĩ QTKD, Đại học Y'), 'postgraduate')
        self.assertEqual(facts.education_level('Khóa học Excel nâng cao'), '')
        self.assertEqual(
            facts.education_level('Trường ĐH Kinh Tế, chuyên ngành Luật'), 'university'
        )

    def test_degree_keywords_match_whole_words_only(self):
        self.assertEqual(facts.education_level('Master of Science in AI'), 'postgraduate')
        self.assertEqual(
            facts.education_level("Master's in Artificial Intelligence"), 'postgraduate'
        )
        # "Scrum Master" là chứng chỉ nghề, "Master Data" là kỹ năng, "samba" không chứa "mba".
        self.assertEqual(
            facts.education_level('Certified Scrum Master, FPT University'), 'university'
        )
        self.assertEqual(facts.education_level('Master Data Management course'), '')
        self.assertEqual(facts.education_level('Câu lạc bộ samba'), '')
        self.assertEqual(facts.language_codes('Quản lý nhóm HSKS'), [])

    def test_position_level_only_from_explicit_titles(self):
        self.assertEqual(facts.position_level('Thư Ký Tổng Giám Đốc', 24), 'employee')
        self.assertEqual(facts.position_level('Team Lead Backend', 40), 'team_lead')
        self.assertEqual(facts.position_level('Thực tập sinh Marketing', 3), 'intern')
        self.assertEqual(facts.position_level('Project Manager', 30), 'employee')
        self.assertEqual(facts.position_level('Fullstack Developer', 0), '')

    def test_language_levels_from_words_and_certificates(self):
        self.assertEqual(facts.language_level('Tiếng Anh: Giao tiếp'), 'conversational')
        self.assertEqual(facts.language_level('English (IELTS 6.5)'), 'working')
        self.assertEqual(facts.language_level('TOEIC 860'), 'professional')
        self.assertEqual(facts.language_level('Tiếng Nhật JLPT N2'), 'professional')
        self.assertEqual(facts.language_level('Tiếng Anh'), '')
        self.assertEqual(facts.language_codes('TOEIC 650; tiếng Hàn'), ['en', 'ko'])


class BuilderProfileTests(SimpleTestCase):
    def full_document(self):
        return builder_document(
            section(
                'summary', {'value': 'Hai năm làm frontend. Liên hệ an@example.com, 0912345678.'}
            ),
            section(
                'experience',
                {
                    'role': 'Frontend Developer',
                    'company': 'Công ty A',
                    'start_date': '2024-11',
                    'end_date': None,
                    'description': rich('Xây dựng cổng bán hàng bằng React và TypeScript.'),
                },
            ),
            section(
                'education', {'degree': 'Cử nhân CNTT', 'institution': 'ĐH B', 'degree_level': ''}
            ),
            section('skills', {'name': 'ReactJS', 'level': 4}, {'name': 'Java', 'level': 3}),
            section('languages', {'name': 'Tiếng Anh', 'value': 'Làm việc · TOEIC 650'}),
        )

    def test_profile_reads_structured_fields_and_keeps_evidence(self):
        profile = cv_profile(self.full_document(), catalog(), today=TODAY)
        self.assertEqual(schema_errors(profile), [])
        self.assertEqual(profile['language'], 'vi')
        self.assertEqual(profile['experience']['months'], 25)
        self.assertEqual(profile['experience']['basis'], 'dates')
        self.assertEqual(profile['education']['level'], 'university')
        self.assertEqual(profile['position_level'], 'employee')
        self.assertEqual(
            profile['languages'],
            [{'code': 'en', 'level': 'working', 'evidence': 'Tiếng Anh: Làm việc · TOEIC 650'}],
        )
        skills = {skill['name']: skill for skill in profile['skills']}
        self.assertIn('React và TypeScript', skills['ReactJS']['evidence'])
        self.assertEqual(skills['Java']['evidence'], '')
        self.assertEqual(profile['quality']['missing'], [])

    def test_chunks_never_carry_contact_details(self):
        chunks = ' '.join(
            chunk['text'] for chunk in cv_profile(self.full_document(), catalog())['chunks']
        )
        self.assertNotIn('an@example.com', chunks)
        self.assertNotIn('0912345678', chunks)

    def test_no_experience_section_is_zero_but_undated_items_are_unknown(self):
        empty = cv_profile(builder_document(section('skills', {'name': 'Java'})), catalog())
        self.assertEqual(
            (empty['experience']['months'], empty['experience']['basis']), (0, 'no_experience')
        )
        undated = cv_profile(
            builder_document(section('experience', {'role': 'Dev', 'company': 'A'})), catalog()
        )
        self.assertIsNone(undated['experience']['months'])
        self.assertIn('experience', undated['quality']['missing'])

    def test_same_document_gives_the_same_profile(self):
        document = self.full_document()
        first = json.dumps(cv_profile(document, catalog(), today=TODAY), sort_keys=True)
        self.assertEqual(
            first, json.dumps(cv_profile(document, catalog(), today=TODAY), sort_keys=True)
        )


UPLOADED_CV = """Ứng viên CV-900
Frontend Developer
an@example.com
MỤC TIÊU NGHỀ NGHIỆP
Hai năm phát triển giao diện web cho thương mại điện tử, thành thạo ReactJS và
JavaScript.
KINH NGHIỆM LÀM VIỆC
Công ty A 03/2024 - Hiện tại
Frontend Developer
Xây dựng trang thanh toán bằng ReactJS, giảm thời gian tải trang còn 1,5 giây.
HỌC VẤN
09/2019 - 06/2023
Cử nhân Công nghệ thông tin
KỸ NĂNG
ReactJS, Java
NGOẠI NGỮ
Tiếng Anh
Giao tiếp
"""


class UploadedProfileTests(SimpleTestCase):
    def test_ordered_pdf_text_uses_its_sections(self):
        profile = text_cv_profile(UPLOADED_CV, catalog(), today=TODAY)
        self.assertEqual(profile['experience']['months'], 33)
        self.assertEqual(profile['experience']['basis'], 'section')
        self.assertEqual(profile['education']['level'], 'university')
        self.assertEqual(profile['languages'][0]['level'], 'conversational')
        skills = {skill['name']: skill for skill in profile['skills']}
        self.assertEqual(skills['ReactJS']['source'], 'declared')
        self.assertEqual(
            skills['ReactJS']['evidence'],
            'Hai năm phát triển giao diện web cho thương mại điện tử, thành thạo ReactJS và JavaScript.',
        )
        self.assertEqual(skills['Java']['evidence'], '')
        # "Giao tiếp" ở mục ngoại ngữ là mức độ, không phải kỹ năng giao tiếp.
        self.assertNotIn('Giao tiếp', skills)
        self.assertIn(
            'thành thạo ReactJS và JavaScript.',
            next(chunk['text'] for chunk in profile['chunks'] if chunk['section'] == 'summary'),
        )

    def test_profiles_follow_the_published_schema(self):
        uploaded = text_cv_profile(UPLOADED_CV, catalog(), today=TODAY)
        self.assertEqual(schema_errors(uploaded), [])
        # Hồ sơ thiếu khóa hoặc mang giá trị ngoài danh sách thì bị bắt.
        broken = {**uploaded, 'position_level': 'senior'}
        del broken['quality']
        self.assertEqual(len(schema_errors(broken)), 1)  # `oneOf`: không khớp dạng CV lẫn dạng tin

    def test_title_is_the_header_line_that_names_a_role(self):
        profile = text_cv_profile(UPLOADED_CV, catalog(), today=TODAY)
        self.assertEqual(profile['title'], 'Frontend Developer')
        self.assertEqual(
            profile['chunks'][0], {'index': 0, 'section': 'title', 'text': 'Frontend Developer'}
        )

    def test_title_is_cut_out_of_a_header_row_with_contact_details(self):
        text = UPLOADED_CV.replace(
            'Ứng viên CV-900\nFrontend Developer\nan@example.com',
            'Nguyễn Văn An\nFrontend Developer  an@example.com  0912 345 678',
        )
        self.assertEqual(
            text_cv_profile(text, catalog(), today=TODAY)['title'], 'Frontend Developer'
        )

    def test_title_falls_back_to_the_role_repeated_across_jobs_never_to_the_name(self):
        text = (
            'Nguyễn Văn An\nan@example.com\n'
            'KINH NGHIỆM LÀM VIỆC\n'
            'Công ty A 03/2020 - 02/2022\nKế toán viên\n'
            'Lập báo cáo tài chính hằng tháng cho ba công ty thành viên của tập đoàn.\n'
            'Công ty B 03/2022 - Hiện tại\nKế toán viên\n'
            'Đối chiếu công nợ và lập tờ khai thuế giá trị gia tăng hằng quý cho công ty.\n'
            'HỌC VẤN\n09/2015 - 06/2019\nCử nhân Kế toán\n'
            'KỸ NĂNG\nJava\n' + 'Chi tiết thêm về công việc đã làm ở từng công ty.\n' * 3
        )
        self.assertEqual(text_cv_profile(text, catalog(), today=TODAY)['title'], 'Kế toán viên')
        only_name = text.replace('Kế toán viên', 'Phòng tài chính')
        self.assertEqual(text_cv_profile(only_name, catalog(), today=TODAY)['title'], '')

    def test_position_level_follows_the_latest_job(self):
        text = (
            'Ứng viên CV-901\nan@example.com\n'
            'KINH NGHIỆM LÀM VIỆC\n'
            'Công ty A 03/2018 - 02/2021\nTrưởng nhóm kinh doanh\n'
            'Dẫn dắt nhóm sáu người đạt chỉ tiêu doanh số trong ba năm liên tiếp.\n'
            'Công ty B 03/2021 - Hiện tại\nNhân viên kinh doanh\n'
            'Chăm sóc tệp khách hàng doanh nghiệp và mở rộng thị trường miền Trung.\n'
            'HỌC VẤN\n09/2014 - 06/2018\nCử nhân Quản trị kinh doanh\n'
            + 'Chi tiết thêm về công việc đã làm ở từng công ty.\n'
            * 3
        )
        self.assertEqual(
            text_cv_profile(text, catalog(), today=TODAY)['position_level'], 'employee'
        )

    def test_slash_inside_a_skill_name_is_kept(self):
        self.assertEqual(
            _declared_names(['CI/CD, Java/JavaScript', 'ReactJS | AI'], catalog()),
            ['CI/CD', 'Java', 'JavaScript', 'ReactJS', 'AI'],
        )

    def test_too_little_text_is_refused(self):
        with self.assertRaises(ExtractionError) as raised:
            text_cv_profile('Ứng viên\nKỹ năng: Java', catalog())
        self.assertEqual(raised.exception.code, 'cv_text_unavailable')

    def test_scrambled_two_column_text_is_read_with_lower_confidence(self):
        scrambled = (
            'Kế toán viên tổng hợp với nhiều năm kinh nghiệm lập báo cáo tài chính và thuế.\n' * 4
            + 'Đại học Kinh tế 09/2015 - 06/2019\nCử nhân Kế toán\n'
            + 'Công ty B 07/2019 - 06/2021\nKế toán viên\n'
            + 'HỌC VẤN\nKINH NGHIỆM LÀM VIỆC\nKỸ NĂNG\n'
        )
        layout = read_layout(scrambled)
        self.assertTrue(layout.scrambled)
        profile = text_cv_profile(scrambled, catalog(), today=TODAY)
        self.assertEqual(profile['experience']['basis'], 'whole_text')
        self.assertEqual(profile['experience']['months'], 24)
        self.assertEqual(profile['education']['level'], 'university')

    def test_never_concludes_no_experience_when_unsure(self):
        unsure = (
            'Nhân viên kinh doanh với kinh nghiệm bán hàng và chăm sóc khách hàng doanh nghiệp.\n'
            * 5
            + 'KINH NGHIỆM LÀM VIỆC\nHỌC VẤN\n'
        )
        profile = text_cv_profile(unsure, catalog(), today=TODAY)
        self.assertIsNone(profile['experience']['months'])
        self.assertIn('experience', profile['quality']['missing'])

    def test_fresh_graduate_with_clean_layout_has_zero_months(self):
        graduate = UPLOADED_CV.replace(
            'KINH NGHIỆM LÀM VIỆC\nCông ty A 03/2024 - Hiện tại\nFrontend Developer\n',
            'DỰ ÁN\nĐồ án 03/2023 - 06/2023\n',
        )
        profile = text_cv_profile(graduate, catalog(), today=TODAY)
        self.assertEqual(
            (profile['experience']['months'], profile['experience']['basis']),
            (0, 'no_experience_section'),
        )
