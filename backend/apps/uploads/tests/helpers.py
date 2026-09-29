from io import BytesIO
from pathlib import Path
from stat import S_IFLNK
from struct import pack, unpack
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

PDF_BYTES = b'%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'
EICAR_PDF_BYTES = b'%PDF-1.7\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE\n%%EOF'


def local_upload_storages(root):
    root = Path(root)
    return {
        'default': {
            'BACKEND': 'common.private_storage.PrivateFileSystemStorage',
            'OPTIONS': {'location': root / 'private', 'base_url': None},
        },
        'private_media': {
            'BACKEND': 'common.private_storage.PrivateFileSystemStorage',
            'OPTIONS': {'location': root / 'private', 'base_url': None},
        },
        'quarantine': {
            'BACKEND': 'common.private_storage.QuarantineFileSystemStorage',
            'OPTIONS': {'location': root / 'quarantine', 'base_url': None},
        },
        'public_media': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
            'OPTIONS': {'location': root / 'public', 'base_url': '/media/'},
        },
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    }


class TemporaryUploadStorageMixin:
    def setUp(self):
        super().setUp()
        from tempfile import TemporaryDirectory

        self.upload_storage_directory = TemporaryDirectory()
        root = Path(self.upload_storage_directory.name)
        self.upload_settings = override_settings(
            PRIVATE_MEDIA_ROOT=root / 'private',
            UPLOAD_QUARANTINE_ROOT=root / 'quarantine',
            PUBLIC_MEDIA_ROOT=root / 'public',
            STORAGES=local_upload_storages(root),
            UPLOAD_QUARANTINE_ENABLED=True,
        )
        self.upload_settings.enable()

    def tearDown(self):
        self.upload_settings.disable()
        self.upload_storage_directory.cleanup()
        super().tearDown()


def pdf_upload(payload=PDF_BYTES, *, name='document.pdf'):
    return SimpleUploadedFile(name, payload, content_type='application/pdf')


def docx_bytes(*, extra_entries=None, document=b'<w:document/>', include_required=True):
    payload = BytesIO()
    with ZipFile(payload, 'w', compression=ZIP_DEFLATED) as archive:
        if include_required:
            archive.writestr('[Content_Types].xml', b'<Types/>')
            archive.writestr('word/document.xml', document)
        for name, value in extra_entries or []:
            archive.writestr(name, value)
    return payload.getvalue()


def docx_upload(payload, *, name='document.docx'):
    return SimpleUploadedFile(
        name,
        payload,
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )


def zip_symlink_info(name='word/linked.xml'):
    info = ZipInfo(name)
    info.create_system = 3
    info.external_attr = (S_IFLNK | 0o777) << 16
    return info


def mark_zip_encrypted(payload):
    mutated = bytearray(payload)
    for signature, flag_offset in ((b'PK\x03\x04', 6), (b'PK\x01\x02', 8)):
        cursor = 0
        while True:
            cursor = mutated.find(signature, cursor)
            if cursor < 0:
                break
            offset = cursor + flag_offset
            flags = unpack('<H', mutated[offset : offset + 2])[0] | 0x1
            mutated[offset : offset + 2] = pack('<H', flags)
            cursor += len(signature)
    return bytes(mutated)
