"""Employer proof documents: verification files, DPA copies and update-request proof.

Every upload adds a new ``CompanyDocument`` version; the file it replaces stays
as audit history with ``is_current=False``.
"""

import hashlib
from pathlib import PurePosixPath
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError

from apps.uploads.services import UploadServiceError, claim_clean_upload
from common.db.public_id import generate_public_id
from common.files.signatures import (
    JPEG_SIGNATURE,
    PDF_SIGNATURE,
    PNG_SIGNATURE,
    SIGNATURE_WINDOW_BYTES,
    ZIP_SIGNATURE,
    has_pdf_header,
)
from common.storage.r2 import private_media_storage

from ..models import CompanyDocument
from ..models.company_update import REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
from .company_update_locks import lock_company_update_request
from .company_update_revisions import snapshot_company_update_request
from .upload_validation import (
    EmployerUploadSessionRejected,
    EmployerUploadStructureError,
    validate_employer_upload_structure,
)
from .verification import get_or_create_verification_case, record_verification_upload

# Only the DPA copy still accepts legacy Word (.doc, an OLE2 compound file), so
# its signature stays here rather than in the shared table.
OLE2_SIGNATURE = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
DOCUMENT_SIGNATURES = {
    'jpg': (JPEG_SIGNATURE, {'image/jpeg'}),
    'png': (PNG_SIGNATURE, {'image/png'}),
    'pdf': (PDF_SIGNATURE, {'application/pdf'}),
    'doc': (OLE2_SIGNATURE, {'application/msword'}),
    'docx': (
        ZIP_SIGNATURE,
        {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
    ),
}

DOCUMENT_CONTENT_TYPES = {
    CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT: {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
}
DEFAULT_DOCUMENT_CONTENT_TYPES = {'application/pdf', 'image/jpeg', 'image/png'}
EMPLOYER_DOCUMENT_CLAIM_SCOPE = 'employer_document'
MAX_DOCUMENTS_PER_TYPE = 10

VERIFICATION_METHOD_DOCUMENT_TYPES = {
    'business_registration': {CompanyDocument.DocType.BUSINESS_REGISTRATION},
    'authorization_and_id': {
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    },
}
VERIFICATION_DOCUMENT_TYPES = frozenset().union(*VERIFICATION_METHOD_DOCUMENT_TYPES.values())
UPDATE_REQUEST_NOT_FOUND = {
    'update_request': gettext_lazy('Không tìm thấy yêu cầu cập nhật đang chờ.')
}


def _matches_signature(extension, header, signature):
    if extension == 'pdf':
        return has_pdf_header(header)
    return header.startswith(signature)


def _allowed_extensions(doc_type):
    if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT:
        return {'pdf', 'doc', 'docx'}
    return {'jpg', 'png', 'pdf'}


def _save_document_file(upload, directory, doc_type):
    if upload.size > settings.IMAGE_UPLOAD_MAX_SIZE:
        raise ValidationError({'file': _('Giấy tờ phải nhỏ hơn 5 MB.')})

    header = upload.read(SIGNATURE_WINDOW_BYTES)
    upload.seek(0)
    extension = next(
        (
            key
            for key, (signature, content_types) in DOCUMENT_SIGNATURES.items()
            if key in _allowed_extensions(doc_type)
            and _matches_signature(key, header, signature)
            and upload.content_type in content_types
        ),
        None,
    )
    if extension is None:
        allowed = (
            _('PDF, DOC hoặc DOCX')
            if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
            else _('JPG, PNG hoặc PDF')
        )
        raise ValidationError(
            {'file': _('Chỉ chấp nhận tệp %(allowed)s hợp lệ.') % {'allowed': allowed}}
        )

    safe_directory = str(PurePosixPath(directory.strip('/')))
    return private_media_storage().save(f'{safe_directory}/{uuid4().hex}.{extension}', upload)


def _claim_scanned_document(*, user, upload_session_public_id, doc_type, for_update, public_id):
    try:
        upload_asset = claim_clean_upload(
            owner=user,
            public_id=upload_session_public_id,
            expected_purpose=('employer_company_update' if for_update else 'employer_verification'),
            claim_scope=EMPLOYER_DOCUMENT_CLAIM_SCOPE,
            claim_reference=public_id,
        )
    except UploadServiceError as error:
        raise EmployerUploadSessionRejected(error) from error
    if upload_asset.size_bytes > settings.IMAGE_UPLOAD_MAX_SIZE:
        raise ValidationError({'upload_session': _('Giấy tờ phải nhỏ hơn 5 MB.')})
    allowed_content_types = DOCUMENT_CONTENT_TYPES.get(doc_type, DEFAULT_DOCUMENT_CONTENT_TYPES)
    if upload_asset.content_type not in allowed_content_types:
        allowed = (
            _('PDF hoặc DOCX')
            if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
            else _('JPG, PNG hoặc PDF')
        )
        raise ValidationError(
            {
                'upload_session': _('Chỉ chấp nhận tệp %(allowed)s đã quét an toàn.')
                % {'allowed': allowed}
            }
        )
    try:
        validate_employer_upload_structure(upload_asset)
    except EmployerUploadStructureError as error:
        raise ValidationError(
            {'upload_session': _('Nội dung tệp bị lỗi hoặc không đúng định dạng khai báo.')}
        ) from error
    return upload_asset


def _remove_obsolete_verification_documents(verification_case, verification_method):
    """Keep old proof files as audit history when a recruiter switches method."""
    current_doc_types = VERIFICATION_METHOD_DOCUMENT_TYPES[verification_method]
    CompanyDocument.objects.filter(
        verification_case=verification_case,
        doc_type__in=VERIFICATION_DOCUMENT_TYPES - current_doc_types,
        update_request__isnull=True,
        is_current=True,
    ).update(is_current=False)


@transaction.atomic
def save_company_document(
    *,
    user,
    recruiter,
    company,
    doc_type,
    upload=None,
    upload_session_public_id='',
    update_request=None,
    verification_method='',
    append_to_current_set=False,
    replace_document_public_id='',
):
    """Store one proof file as the next version of its document set.

    The set is the update request's documents, the recruiter's verification
    case (verification proof and DPA) or, otherwise, the company's loose files.
    By default the new file supersedes the whole current set;
    ``append_to_current_set`` adds to it (up to ten files) and
    ``replace_document_public_id`` supersedes a single file. Choosing a
    ``verification_method`` retires current proof of the other method.
    """
    if update_request is not None and company is not None:
        company, update_request = lock_company_update_request(
            company_id=company.pk,
            update_request_id=update_request.pk,
        )
    if update_request is not None and (
        update_request.requested_by_id != user.id
        or company is None
        or update_request.company_id != company.id
        or update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
    ):
        raise ValidationError(UPDATE_REQUEST_NOT_FOUND)
    if company is None and recruiter.company_id:
        company = recruiter.company
    if company is not None:
        directory = f'employers/{company.public_id}/documents'
    elif doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT and recruiter is not None:
        directory = f'employers/{recruiter.public_id}/documents'
    else:
        raise ValidationError({'detail': _('Không xác định được chủ sở hữu của giấy tờ.')})

    verification_case = None
    existing = None
    document_scope = None
    if update_request is not None:
        document_scope = CompanyDocument.objects.select_for_update().filter(
            update_request=update_request,
            doc_type=doc_type,
            is_current=True,
        )
    elif doc_type in VERIFICATION_DOCUMENT_TYPES | {
        CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
    }:
        verification_case = get_or_create_verification_case(recruiter)
        document_scope = CompanyDocument.objects.select_for_update().filter(
            verification_case=verification_case,
            doc_type=doc_type,
            is_current=True,
        )

    if document_scope is not None:
        if replace_document_public_id:
            existing = document_scope.filter(public_id=replace_document_public_id).first()
            if existing is None:
                raise ValidationError({'replaces': _('Không tìm thấy tệp hiện hành cần thay thế.')})
            existing.is_current = False
            existing.save(update_fields=['is_current', 'updated_at'])
        elif append_to_current_set:
            if document_scope.count() >= MAX_DOCUMENTS_PER_TYPE:
                raise ValidationError({'file': _('Mỗi loại giấy tờ được tải tối đa 10 tệp.')})
        else:
            existing = document_scope.order_by('-version', '-created_at', '-id').first()
            if existing is not None:
                document_scope.update(is_current=False)

    version_scope = CompanyDocument.objects.filter(doc_type=doc_type)
    if update_request is not None:
        version_scope = version_scope.filter(update_request=update_request)
    elif verification_case is not None:
        version_scope = version_scope.filter(verification_case=verification_case)
    else:
        version_scope = version_scope.filter(
            company=company,
            recruiter=recruiter,
            update_request__isnull=True,
            verification_case__isnull=True,
        )
    latest_version = (
        version_scope.order_by('-version', '-created_at', '-id')
        .values_list('version', flat=True)
        .first()
        or 0
    )

    upload_asset = None
    document_public_id = generate_public_id('doc')
    if upload_session_public_id:
        upload_asset = _claim_scanned_document(
            user=user,
            upload_session_public_id=upload_session_public_id,
            doc_type=doc_type,
            for_update=update_request is not None,
            public_id=document_public_id,
        )
        path = upload_asset.storage_key
        mime_type = upload_asset.content_type
        file_size = upload_asset.size_bytes
        checksum = upload_asset.checksum_sha256
        original_name = upload_asset.original_filename
    else:
        digest = hashlib.sha256()
        for chunk in upload.chunks():
            digest.update(chunk)
        upload.seek(0)
        path = _save_document_file(upload, directory, doc_type)
        mime_type = upload.content_type or ''
        file_size = upload.size
        checksum = digest.hexdigest()
        original_name = upload.name
    document_name = (
        'Thỏa thuận xử lý DLCN'
        if doc_type == CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
        else original_name
    )

    document = CompanyDocument.objects.create(
        public_id=document_public_id,
        company=company,
        uploaded_by=user,
        update_request=update_request,
        recruiter=recruiter,
        verification_case=verification_case,
        supersedes=existing,
        version=latest_version + 1,
        doc_type=doc_type,
        file_url=path,
        file_name=document_name,
        mime_type=mime_type,
        file_size=file_size,
        sha256=checksum,
        upload_asset=upload_asset,
    )
    if verification_case is not None:
        record_verification_upload(
            recruiter=recruiter,
            document=document,
            verification_method=verification_method,
        )
    elif update_request is not None:
        snapshot_company_update_request(update_request, actor=user)
    if verification_method:
        _remove_obsolete_verification_documents(verification_case, verification_method)
    return document


@transaction.atomic
def save_company_website_proof(*, user, recruiter, website_url, company=None, update_request=None):
    """Prove the trade name with a website URL instead of a file.

    Inside ``update_request`` (locked through the recruiter's company) the URL
    supersedes the request's current proof; otherwise it is a loose company
    document of ``company``.
    """
    existing = None
    if update_request is not None:
        company, update_request = lock_company_update_request(
            company_id=recruiter.company_id,
            update_request_id=update_request.pk,
        )
        if (
            update_request.requested_by_id != user.id
            or update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
        ):
            raise ValidationError(UPDATE_REQUEST_NOT_FOUND)
        existing = (
            CompanyDocument.objects.select_for_update()
            .filter(
                update_request=update_request,
                doc_type=CompanyDocument.DocType.TRADE_NAME_PROOF,
                is_current=True,
            )
            .first()
        )
        if existing is not None:
            existing.is_current = False
            existing.save(update_fields=['is_current', 'updated_at'])
    document = CompanyDocument.objects.create(
        company=company,
        recruiter=recruiter,
        uploaded_by=user,
        update_request=update_request,
        supersedes=existing,
        version=(existing.version + 1 if existing else 1),
        doc_type=CompanyDocument.DocType.TRADE_NAME_PROOF,
        file_url=website_url,
        file_name='Website chứng minh tên thương mại',
    )
    if update_request is not None:
        snapshot_company_update_request(update_request, actor=user)
    return document
