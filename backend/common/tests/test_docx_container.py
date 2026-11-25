from io import BytesIO
from stat import S_IFLNK
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo

from django.test import SimpleTestCase

from common.files.docx import (
    LEGACY_DOCX_LIMITS,
    DocxLimits,
    UnsafeDocxContainer,
    validate_docx_container,
)

SMALL_LIMITS = DocxLimits(
    max_entries=5,
    max_uncompressed_bytes=4096,
    max_document_xml_bytes=1024,
    max_compression_ratio=20,
)


def _docx(*, document=b'<w:document/>', extra=(), required=True, compression=ZIP_DEFLATED):
    payload = BytesIO()
    with ZipFile(payload, 'w', compression=compression) as archive:
        if required:
            archive.writestr('[Content_Types].xml', b'<Types/>')
            archive.writestr('word/document.xml', document)
        for name, value in extra:
            archive.writestr(name, value)
    payload.seek(0)
    return payload


class DocxContainerTests(SimpleTestCase):
    def assertRejected(self, stream, limits=SMALL_LIMITS):
        with self.assertRaises(UnsafeDocxContainer):
            validate_docx_container(stream, limits)

    def test_minimal_docx_is_accepted_and_the_stream_is_rewound(self):
        stream = _docx()
        stream.seek(7)

        validate_docx_container(stream, SMALL_LIMITS)

        self.assertEqual(stream.tell(), 0)

    def test_container_without_the_main_parts_is_rejected(self):
        self.assertRejected(_docx(required=False, extra=[('word/other.xml', b'<x/>')]))

    def test_bytes_that_are_not_a_zip_are_rejected(self):
        self.assertRejected(BytesIO(b'PK\x03\x04' + b'\x00' * 64))

    def test_too_many_entries_are_rejected(self):
        extra = [(f'word/media/{index}.xml', b'<x/>') for index in range(4)]
        self.assertRejected(_docx(extra=extra))

    def test_main_document_part_over_its_own_cap_is_rejected(self):
        # Nén STORED để tỉ lệ nén không phải lý do bị chặn.
        self.assertRejected(_docx(document=b'a' * 2048, compression=ZIP_STORED))

    def test_total_uncompressed_size_over_the_cap_is_rejected(self):
        extra = [('word/media/blob.bin', b'b' * 4096)]
        self.assertRejected(_docx(extra=extra, compression=ZIP_STORED))

    def test_zip_bomb_compression_ratio_is_rejected(self):
        bomb = _docx(document=b'<w:document>' + b'0' * (2 * 1024 * 1024) + b'</w:document>')
        self.assertRejected(bomb, LEGACY_DOCX_LIMITS)

    def test_path_traversal_and_absolute_names_are_rejected(self):
        for name in ('../evil.xml', '/etc/passwd', 'word\\evil.xml', 'word/a:b.xml'):
            with self.subTest(name=name):
                self.assertRejected(_docx(extra=[(name, b'<x/>')]))

    def test_symlink_entry_is_rejected(self):
        link = ZipInfo('word/linked.xml')
        link.create_system = 3
        link.external_attr = (S_IFLNK | 0o777) << 16
        self.assertRejected(_docx(extra=[(link, b'/etc/passwd')]))

    def test_encrypted_entry_is_rejected(self):
        payload = bytearray(_docx().getvalue())
        # Bật cờ "encrypted" (bit 0) trong cả local header và central directory.
        for signature, offset in ((b'PK\x03\x04', 6), (b'PK\x01\x02', 8)):
            start = payload.find(signature)
            while start >= 0:
                payload[start + offset] |= 0x1
                start = payload.find(signature, start + 4)
        self.assertRejected(BytesIO(bytes(payload)))
