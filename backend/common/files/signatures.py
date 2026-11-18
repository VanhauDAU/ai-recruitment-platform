"""Magic-byte signatures shared by every upload validator.

The declared content type and file extension are client input; these prefixes
are the only evidence of what the bytes really are, so one table serves all
validators and a fix here reaches every upload path.
"""

PDF_SIGNATURE = b'%PDF-'
# ISO 32000 readers locate the header within the first 1024 bytes, and some
# generators emit a newline or a UTF-8 BOM before it. Only these bytes may come
# first, so another format cannot be smuggled in front of the header.
PDF_LEADING_BYTES = b'\x00\t\n\x0c\r \xef\xbb\xbf'
SIGNATURE_WINDOW_BYTES = 1024
JPEG_SIGNATURE = b'\xff\xd8\xff'
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
GIF_SIGNATURES = (b'GIF87a', b'GIF89a')
# DOCX (like every OOXML file) is a ZIP container; callers must still inspect it.
ZIP_SIGNATURE = b'PK\x03\x04'


def pdf_header_offset(prefix):
    """Return where the PDF header starts in ``prefix``, or -1 when it is not a PDF."""
    window = bytes(prefix[:SIGNATURE_WINDOW_BYTES])
    offset = len(window) - len(window.lstrip(PDF_LEADING_BYTES))
    return offset if window.startswith(PDF_SIGNATURE, offset) else -1


def has_pdf_header(prefix):
    """Return True when ``prefix`` (the first bytes of a file) opens a PDF."""
    return pdf_header_offset(prefix) >= 0


def is_webp(prefix):
    """WebP is a RIFF container whose form type sits at bytes 8-12."""
    return prefix[:4] == b'RIFF' and prefix[8:12] == b'WEBP'


def image_content_type(prefix):
    """Return the image MIME type proven by ``prefix``, or '' for anything else."""
    if prefix.startswith(PNG_SIGNATURE):
        return 'image/png'
    if prefix.startswith(JPEG_SIGNATURE):
        return 'image/jpeg'
    if prefix.startswith(GIF_SIGNATURES):
        return 'image/gif'
    if is_webp(prefix):
        return 'image/webp'
    return ''
