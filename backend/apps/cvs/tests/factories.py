"""Real, minimal CV files that pass the CV upload standards."""

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile

CV_LINES = (
    'Nguyen Van An - Software Engineer',
    'Email: an.nguyen@example.com | Phone: 0912 345 678',
    'Muc tieu nghe nghiep: xay dung san pham web chat luong cao.',
    'Kinh nghiem lam viec: Backend Developer tai ABC (2021 - nay).',
    'Hoc van: Dai hoc Bach khoa Da Nang, Cong nghe thong tin.',
    'Ky nang: Python, Django, PostgreSQL, React.',
)


def pdf_bytes(lines=CV_LINES):
    """Hand-built single-page PDF with a real text layer (Helvetica, ASCII)."""

    def escape(line):
        return line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    text_ops = ''.join(f'({escape(line)}) Tj T* ' for line in lines)
    stream = f'BT /F1 11 Tf 14 TL 50 780 Td {text_ops}ET'.encode('latin-1')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
        b'/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream',
    ]
    output = BytesIO()
    output.write(b'%PDF-1.4\n')
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(b'%d 0 obj\n' % number + body + b'\nendobj\n')
    xref = output.tell()
    output.write(b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1))
    output.writelines(b'%010d 00000 n \n' % offset for offset in offsets)
    output.write(
        b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref)
    )
    return output.getvalue()


def docx_bytes(lines=CV_LINES):
    from docx import Document

    document = Document()
    for line in lines:
        document.add_paragraph(line)
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def cv_pdf_upload(name='cv.pdf', lines=CV_LINES):
    return SimpleUploadedFile(name, pdf_bytes(lines), content_type='application/pdf')
