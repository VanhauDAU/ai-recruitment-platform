"""Upload standards and CV recognition for candidate CV files (PDF/DOCX).

Used both when a candidate uploads a CV as-is and by the AI import job, so a
file is accepted or rejected for the same reasons everywhere.
"""

import re
import unicodedata

MAX_CV_PAGES = 20
# A CV rarely exceeds a few pages; reports and theses are far longer.
MAX_CV_TEXT_CHARS = 30_000
# A PDF with a real text layer has far more than this; less means a scan.
MIN_PDF_TEXT_CHARS = 40
MIN_CV_SECTION_GROUPS = 2
# A section heading is a short line (or the part before ":"), not prose.
MAX_HEADING_CHARS = 40

REJECTION_MESSAGES = {
    'unsupported_file_type': 'Chỉ hỗ trợ tệp PDF hoặc DOCX.',
    'encrypted_pdf': 'PDF đang được đặt mật khẩu. Hãy gỡ mật khẩu rồi tải lên lại.',
    'too_many_pages': f'CV không được dài quá {MAX_CV_PAGES} trang.',
    'text_extraction_failed': 'Không đọc được nội dung tệp. Tệp có thể đã bị hỏng.',
    'scanned_pdf_ocr_unavailable': (
        'PDF là bản scan chưa có lớp chữ. Hãy dùng PDF có thể bôi đen chữ hoặc tệp DOCX.'
    ),
    'insufficient_text': 'Tệp gần như không có nội dung chữ.',
    'text_too_long': 'Nội dung tệp quá dài so với một CV.',
    'not_a_cv': (
        'Tệp không giống một CV. CV cần có email hoặc số điện thoại và các mục như '
        'kinh nghiệm, học vấn, kỹ năng.'
    ),
}

# Section headings, matched without Vietnamese diacritics. Experience,
# education and skills are the core of any CV; at least one must be present.
_CORE_SECTIONS = ('experience', 'education', 'skills')
_CV_SECTION_GROUPS = {
    'experience': ('kinh nghiem', 'qua trinh cong tac', 'experience', 'employment', 'work history'),
    'education': ('hoc van', 'trinh do', 'education', 'academic'),
    'skills': ('ky nang', 'skill'),
    'summary': ('muc tieu', 'gioi thieu ban than', 'objective', 'summary', 'profile'),
    'projects': ('du an', 'project'),
    'certifications': ('chung chi', 'bang cap', 'certific', 'license'),
    'awards': ('giai thuong', 'thanh tich', 'award', 'achievement'),
    'activities': ('hoat dong', 'activit', 'volunteer'),
    'interests': ('so thich', 'interest', 'hobbies'),
    'references': ('nguoi tham chieu', 'tham khao', 'reference'),
    'languages': ('ngoai ngu', 'language'),
    'personal': ('thong tin ca nhan', 'personal'),
}
_EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
_PHONE = re.compile(r'(?<!\d)\+?\d(?:[\s.\-()]*\d){8,13}(?!\d)')


class CvDocumentRejected(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(REJECTION_MESSAGES[code])


def _read_pdf_text(source):
    """pypdf checks the password and page count; pypdfium2 reads the text.

    pypdf splits Vietnamese words with diacritics ("Ứ ng viên") in about 9% of
    words, pypdfium2 split none across 51 test CVs (`ml/reports/extract_check.md`).
    """
    import pypdfium2
    from pypdf import PdfReader

    reader = PdfReader(source)
    if reader.is_encrypted:
        raise CvDocumentRejected('encrypted_pdf')
    if len(reader.pages) > MAX_CV_PAGES:
        raise CvDocumentRejected('too_many_pages')
    source.seek(0)
    document = pypdfium2.PdfDocument(source.read())
    try:
        return '\n'.join(page.get_textpage().get_text_bounded() for page in document)
    finally:
        document.close()


def clean_document_text(text):
    """NFC, Unix newlines, private-use characters (template icon fonts) as spaces.

    Icons stand between words ("Sep 2020 <icon> Jun 2024"), so they become a
    space rather than vanish and glue the words together.
    """
    text = unicodedata.normalize('NFC', text).replace('\r\n', '\n').replace('\r', '\n')
    return ''.join(' ' if unicodedata.category(char) == 'Co' else char for char in text)


def _read_text(source, file_type):
    if file_type == 'pdf':
        return _read_pdf_text(source)
    if file_type == 'docx':
        from docx import Document

        document = Document(source)
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        cells = [cell.text for table in document.tables for row in table.rows for cell in row.cells]
        return '\n'.join(paragraphs + cells)
    raise CvDocumentRejected('unsupported_file_type')


def extract_cv_text(source, file_type):
    """Return the document text, enforcing the page, text-layer and size standards."""
    try:
        text = clean_document_text(_read_text(source, file_type)).strip()
    except CvDocumentRejected:
        raise
    except Exception as error:
        raise CvDocumentRejected('text_extraction_failed') from error
    finally:
        if hasattr(source, 'seek'):
            source.seek(0)
    if file_type == 'pdf' and len(text) < MIN_PDF_TEXT_CHARS:
        raise CvDocumentRejected('scanned_pdf_ocr_unavailable')
    if len(text) < 10:
        raise CvDocumentRejected('insufficient_text')
    if len(text) > MAX_CV_TEXT_CHARS:
        raise CvDocumentRejected('text_too_long')
    return text


def _fold(text):
    decomposed = unicodedata.normalize('NFD', text.casefold().replace('đ', 'd'))
    return ''.join(char for char in decomposed if not unicodedata.combining(char))


def _compact(text):
    # PDF text layers often split Vietnamese words ("Mụ c tiêu ngh ề"), so
    # headings are compared without diacritics and without any whitespace.
    return _WHITESPACE.sub('', _fold(text))


_WHITESPACE = re.compile(r'\s+')
_CV_SECTION_KEYS = {
    section: tuple(_compact(key) for key in keys) for section, keys in _CV_SECTION_GROUPS.items()
}


def _heading_key(line):
    head = _compact(line.split(':', 1)[0])
    return head if 0 < len(head) <= MAX_HEADING_CHARS else ''


# A section heading is the section name plus at most a few words
# ("Kinh nghiệm làm việc", "Technical Skills"), not a title that merely
# contains the keyword ("Nhóm Phát triển SoftSkills").
MAX_HEADING_EXTRA_CHARS = 15


def heading_section(line):
    """CV section a heading line names (`'experience'`, `'skills'`…), or None.

    When several sections match ("Trình độ ngoại ngữ"), the longest keyword wins.
    """
    head = _heading_key(line)
    matches = [
        (len(key), -order, section)
        for order, (section, keys) in enumerate(_CV_SECTION_KEYS.items())
        for key in keys
        if head and key in head
    ]
    if not matches:
        return None
    length, _, section = max(matches)
    return section if len(head) - length <= MAX_HEADING_EXTRA_CHARS else None


def looks_like_cv(text):
    """A CV names a way to contact the candidate and is organised in CV sections.

    Keywords only count on heading-like lines, so a report or letter that merely
    mentions "kinh nghiệm" or "kỹ năng" in its prose is not taken for a CV.
    """
    if not (_EMAIL.search(text) or _PHONE.search(text)):
        return False
    headings = [head for head in map(_heading_key, text.splitlines()) if head]
    found = {
        section
        for section, keys in _CV_SECTION_KEYS.items()
        if any(key in heading for heading in headings for key in keys)
    }
    return len(found) >= MIN_CV_SECTION_GROUPS and any(key in found for key in _CORE_SECTIONS)


def scrub_contacts(text):
    """Text without email addresses and phone numbers (kept out of matching profiles)."""
    return _PHONE.sub('', _EMAIL.sub('', text))


def read_cv_document(source, file_type):
    """Extract text and reject files that do not meet the standards or are not a CV."""
    text = extract_cv_text(source, file_type)
    if not looks_like_cv(text):
        raise CvDocumentRejected('not_a_cv')
    return text
