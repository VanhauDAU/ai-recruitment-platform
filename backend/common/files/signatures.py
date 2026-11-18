"""Content signatures shared by upload validators."""

PDF_SIGNATURE = b'%PDF-'
# ISO 32000 readers locate the header within the first 1024 bytes, and some
# generators emit a newline or a UTF-8 BOM before it. Only these bytes may come
# first, so another format cannot be smuggled in front of the header.
PDF_LEADING_BYTES = b'\x00\t\n\x0c\r \xef\xbb\xbf'
SIGNATURE_WINDOW_BYTES = 1024


def pdf_header_offset(prefix):
    """Return where the PDF header starts in ``prefix``, or -1 when it is not a PDF."""
    window = bytes(prefix[:SIGNATURE_WINDOW_BYTES])
    offset = len(window) - len(window.lstrip(PDF_LEADING_BYTES))
    return offset if window.startswith(PDF_SIGNATURE, offset) else -1


def has_pdf_header(prefix):
    """Return True when ``prefix`` (the first bytes of a file) opens a PDF."""
    return pdf_header_offset(prefix) >= 0
