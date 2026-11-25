"""Thứ tự đọc dựng lại từ vị trí ký tự (`services/pdf_layout.py`)."""

from django.test import SimpleTestCase

from ..services.cv_document import _is_heading_line, _join_split_headings
from ..services.pdf_layout import Block, continue_columns, page_blocks, page_text

CHAR_WIDTH, LINE_HEIGHT = 5, 10


def line(text, left, top):
    """Ký tự của một dòng chữ vẽ từ `left`, mỗi ký tự rộng 5 và cao 10."""
    return [
        (char, left + index * CHAR_WIDTH, top, left + (index + 1) * CHAR_WIDTH, top + LINE_HEIGHT)
        for index, char in enumerate(text)
    ]


def drawn(*lines):
    """Ghép các dòng theo đúng thứ tự vẽ trong tệp (không theo vị trí)."""
    return [char for chars in lines for char in chars]


class ReadingOrderTests(SimpleTestCase):
    def test_single_column_reads_top_to_bottom_whatever_the_drawing_order(self):
        chars = drawn(
            line('Automation Tester', 30, 60),
            line('Jan 2023 - Jul 2023', 30, 75),
            line('WORK EXPERIENCE', 30, 40),  # tiêu đề vẽ sau nội dung của nó
        )
        self.assertEqual(
            page_text(chars), 'WORK EXPERIENCE\nAutomation Tester\nJan 2023 - Jul 2023'
        )

    def test_two_columns_are_read_one_after_the_other(self):
        left = [
            line(text, 30, 40 + 15 * row)
            for row, text in enumerate(['SKILLS', 'Python', 'SQL', 'Docker'])
        ]
        right = [
            line(text, 300, 43 + 15 * row)
            for row, text in enumerate(
                ['EXPERIENCE', 'Backend Developer', 'Built payment APIs', 'Cut latency']
            )
        ]
        # Vẽ xen kẽ hai cột: đọc theo hàng sẽ trộn "Python" với "Backend Developer".
        chars = drawn(*[chars for pair in zip(left, right, strict=True) for chars in pair])
        self.assertEqual(
            page_text(chars).split('\n'),
            [
                'SKILLS',
                'Python',
                'SQL',
                'Docker',
                'EXPERIENCE',
                'Backend Developer',
                'Built payment APIs',
                'Cut latency',
            ],
        )

    def test_a_line_spanning_both_columns_splits_the_page_into_bands(self):
        chars = drawn(
            line(
                'NGUYEN VAN AN - BACKEND DEVELOPER WITH FIVE YEARS OF EXPERIENCE IN PAYMENTS',
                30,
                10,
            ),
            *[
                line(text, 30, 40 + 15 * row)
                for row, text in enumerate(['SKILLS', 'Python', 'SQL'])
            ],
            *[
                line(text, 300, 40 + 15 * row)
                for row, text in enumerate(
                    ['EXPERIENCE', 'Backend Developer', 'Built payment APIs']
                )
            ],
        )
        lines = page_text(chars).split('\n')
        self.assertTrue(lines[0].startswith('NGUYEN VAN AN'))
        self.assertEqual(
            lines[1:],
            ['SKILLS', 'Python', 'SQL', 'EXPERIENCE', 'Backend Developer', 'Built payment APIs'],
        )

    def test_a_margin_column_of_dates_stays_with_its_row(self):
        dates = [
            line(text, 30, 40 + 45 * row)
            for row, text in enumerate(['01/2021 - 12/2021', '01/2022 - 12/2022', '01/2023 - Nay'])
        ]
        jobs = [
            chars
            for row, company in enumerate(['Cong ty A', 'Cong ty B', 'Cong ty C'])
            for chars in (
                line(company, 200, 40 + 45 * row),
                line('Ke toan vien', 200, 55 + 45 * row),
            )
        ]
        self.assertEqual(
            page_text(drawn(*dates, *jobs)).split('\n'),
            [
                '01/2021 - 12/2021  Cong ty A', 'Ke toan vien',
                '01/2022 - 12/2022  Cong ty B', 'Ke toan vien',
                '01/2023 - Nay  Cong ty C', 'Ke toan vien',
            ],
        )  # fmt: skip

    def test_ligatures_and_line_end_hyphens(self):
        # "ffi" là một hình vẽ: ba ký tự mang cùng một khung, không được chèn khoảng trắng.
        ligature = [('f', 35, 10, 45, 20), ('f', 35, 10, 45, 20), ('i', 35, 10, 45, 20)]
        chars = [('O', 30, 10, 35, 20), *ligature, *line('cer', 45, 10), ('￾', 60, 10, 65, 20)]
        self.assertEqual(page_text(chars), 'Officer-')

    def test_words_are_separated_by_the_gap_between_them(self):
        chars = drawn(line('Kotlin', 30, 10), line('Swift', 30 + 6 * CHAR_WIDTH + 4, 10))
        self.assertEqual(page_text(chars), 'Kotlin Swift')


class ColumnBlockTests(SimpleTestCase):
    """CV hai cột dài hơn một trang: phần tiếp của một cột thuộc về chính cột đó."""

    def test_two_column_page_gives_a_block_per_column(self):
        chars = drawn(
            line('SKILLS', 20, 40),
            line('React', 20, 55),
            line('Teamwork', 20, 70),
            line('EXPERIENCE', 200, 40),
            line('Frontend Developer at Alpha', 200, 55),
            line('Built the checkout page', 200, 70),
        )

        blocks = page_blocks(chars)

        self.assertEqual(
            [block.lines for block in blocks],
            [
                ['SKILLS', 'React', 'Teamwork'],
                ['EXPERIENCE', 'Frontend Developer at Alpha', 'Built the checkout page'],
            ],
        )
        self.assertLess(blocks[0].right, blocks[1].left)

    def test_text_before_the_first_heading_continues_the_column_above_it(self):
        first_page = [
            Block(20, 120, ['SKILLS', 'React']),
            Block(200, 500, ['ACTIVITIES', 'Volunteer 2015 - 2017', 'Collected waste for']),
        ]
        second_page = [
            Block(20, 120, ['CERTIFICATIONS', 'Docker Essentials']),
            Block(200, 500, ['the local community', 'REFERENCES', 'Jane Doe']),
        ]

        lines = continue_columns([first_page, second_page], _is_heading_line)

        # "the local community" theo cột phải của trang trước, không dính vào Chứng chỉ.
        self.assertEqual(
            lines,
            [
                'SKILLS',
                'React',
                'ACTIVITIES',
                'Volunteer 2015 - 2017',
                'Collected waste for',
                'the local community',
                'CERTIFICATIONS',
                'Docker Essentials',
                'REFERENCES',
                'Jane Doe',
            ],
        )

    def test_single_block_page_continues_the_column_it_sits_under(self):
        first_page = [
            Block(20, 120, ['EDUCATION', 'College of Business']),
            Block(200, 500, ['EXPERIENCE', 'Office Administrator']),
        ]
        second_page = [Block(200, 500, ['Used Excel to analyse data'])]

        lines = continue_columns([first_page, second_page], _is_heading_line)

        self.assertEqual(lines[-2:], ['Office Administrator', 'Used Excel to analyse data'])
        self.assertEqual(lines[:2], ['EDUCATION', 'College of Business'])

    def test_name_on_top_of_the_right_column_opens_the_document(self):
        page = [
            Block(20, 120, ['EDUCATION', 'Art Academy', 'SKILLS']),
            Block(200, 500, ['Graphic Designer', 'OBJECTIVE', 'Nine years of design']),
        ]

        lines = continue_columns([page], _is_heading_line)

        self.assertEqual(lines[0], 'Graphic Designer')
        self.assertEqual(lines[-3:], ['SKILLS', 'OBJECTIVE', 'Nine years of design'])

    def test_one_column_document_keeps_its_order(self):
        pages = [
            [Block(20, 500, ['EXPERIENCE', 'Line one'])],
            [Block(20, 500, ['line two', 'SKILLS'])],
        ]
        self.assertEqual(
            continue_columns(pages, _is_heading_line),
            ['EXPERIENCE', 'Line one', 'line two', 'SKILLS'],
        )

    def test_heading_wrapped_over_two_lines_is_joined(self):
        self.assertEqual(
            _join_split_headings(['Danh hiệu và giải', 'thưởng', 'Nhân viên tiêu biểu 2023']),
            ['Danh hiệu và giải thưởng', 'Nhân viên tiêu biểu 2023'],
        )
        # Dòng sau một tiêu đề trọn vẹn là nội dung, không bị nối.
        self.assertEqual(_join_split_headings(['Kỹ năng', 'React']), ['Kỹ năng', 'React'])
