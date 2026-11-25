"""Tệp đính kèm: kiểm chữ ký + cấu trúc như giấy tờ NTD, lưu kho riêng tư, đọc qua API."""

from pathlib import PurePosixPath
from uuid import uuid4

from django.db import transaction
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound, ValidationError

from apps.cvs.models import CvAccessLog
from apps.cvs.services import open_snapshot_source_pdf, record_application_snapshot_access
from apps.employers.services import (
    EmployerUploadStructureError,
    ensure_recruiter_candidate_data_access,
    validate_employer_document_file,
)
from common.files.signatures import SIGNATURE_WINDOW_BYTES, has_pdf_header, image_content_type
from common.storage.r2 import private_media_storage

from ..domain import Role
from ..models import Message
from .messages import send_message
from .policy import attachment_max_bytes

DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
ZIP_SIGNATURE = b'PK\x03\x04'
IMAGE_EXTENSIONS = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}


def _detect(upload):
    header = upload.read(SIGNATURE_WINDOW_BYTES)
    upload.seek(0)
    if has_pdf_header(header):
        return 'application/pdf', 'pdf'
    image_type = image_content_type(header)
    if image_type in IMAGE_EXTENSIONS:
        return image_type, IMAGE_EXTENSIONS[image_type]
    if header.startswith(ZIP_SIGNATURE) and upload.name.lower().endswith('.docx'):
        return DOCX_TYPE, 'docx'
    return None, None


def _safe_name(name, extension):
    stem = PurePosixPath(str(name or '').replace('\\', '/')).stem.strip()[:120] or 'tep'
    return f'{stem}.{extension}'


def store_attachment(upload, conversation_public_id):
    """Kiểm tra và lưu tệp; trả các trường của ``Message`` (chưa ghi DB)."""
    if upload.size > attachment_max_bytes():
        raise ValidationError(
            {'file': _('Tệp tối đa %(mb)s MB.') % {'mb': attachment_max_bytes() // (1024 * 1024)}}
        )
    content_type, extension = _detect(upload)
    if content_type is None:
        raise ValidationError({'file': _('Chỉ gửi được tệp PDF, DOCX hoặc ảnh JPG, PNG, WEBP.')})
    try:
        validate_employer_document_file(upload, content_type)
    except EmployerUploadStructureError as error:
        raise ValidationError(
            {'file': _('Nội dung tệp bị lỗi hoặc không đúng định dạng.')}
        ) from error
    upload.seek(0)
    key = private_media_storage().save(
        f'messaging/{conversation_public_id}/{uuid4().hex}.{extension}', upload
    )
    return {
        'attachment_key': key,
        'attachment_name': _safe_name(upload.name, extension),
        'attachment_type': content_type,
        'attachment_size': upload.size,
    }


def send_attachment(user, role, public_id, *, client_id, upload):
    fields = store_attachment(upload, public_id)
    kind = (
        Message.Kind.IMAGE if fields['attachment_type'].startswith('image/') else Message.Kind.FILE
    )
    try:
        message, created = send_message(
            user, role, public_id, client_id=client_id, kind=kind, file_fields=fields
        )
    except Exception:
        private_media_storage().delete(fields['attachment_key'])
        raise
    if not created:
        # Gửi lại cùng client_id: tin cũ đã có tệp, bỏ bản vừa lưu.
        transaction.on_commit(lambda: private_media_storage().delete(fields['attachment_key']))
    return message, created


def open_message_file(message, role, *, viewer, request):
    """``(stream, content_type, filename)`` của tệp/ảnh/CV dạng tệp trong một tin."""
    if message.erased_at is not None:
        raise NotFound
    if message.kind == Message.Kind.CV:
        if role == Role.RECRUITER:
            ensure_recruiter_candidate_data_access(viewer)
        version = message.cv_version
        stream = open_snapshot_source_pdf(version) if version else None
        if stream is None:
            raise NotFound
        if role == Role.RECRUITER:
            record_application_snapshot_access(
                version=version,
                actor=viewer,
                request=request,
                channel=CvAccessLog.AccessChannel.MESSAGE,
            )
        title = (message.payload or {}).get('cv_title') or 'CV'
        return stream, 'application/pdf', f'{title}.pdf'
    if message.kind not in (Message.Kind.FILE, Message.Kind.IMAGE) or not message.attachment_key:
        raise NotFound
    try:
        stream = private_media_storage().open(message.attachment_key, 'rb')
    except OSError as error:
        raise NotFound from error
    return stream, message.attachment_type, message.attachment_name
