"""Bước 3 của đối sánh: lưu hồ sơ và vector (`MatchDocument`, `MatchChunk`).

Một tài liệu được xác định bởi (nguồn, hash nội dung, phiên bản trích xuất,
phiên bản mô hình). Cùng bộ đó thì dùng lại hàng đã có, nên CV/tin chỉ được mã
hóa một lần cho tới khi đổi nội dung hoặc đổi mô hình. Trích xuất thất bại
(CV scan, tin quá ngắn) cũng được lưu, với `status = failed` và mã lỗi.
"""

import hashlib
import json

import numpy as np
from django.db import IntegrityError, transaction

from apps.cvs.models import UserCv
from apps.cvs.services import CvDocumentRejected, extract_cv_text, open_uploaded_cv_pdf

from ..models import MatchChunk, MatchDocument
from .extraction import EXTRACTOR_VERSION, ExtractionError, cv_profile, job_profile, text_cv_profile

# Câu của tin là "query", câu của CV là "passage" (quy ước của E5).
ENCODE_KIND = {MatchDocument.Kind.CV: 'passage', MatchDocument.Kind.JOB: 'query'}
# Vector toàn văn: nối các chunk (trừ tên kỹ năng) rồi cắt cho vừa 512 token.
DOCUMENT_TEXT_MAX_CHARS = 2000


def document_text(profile):
    texts = [chunk['text'] for chunk in profile.get('chunks', []) if chunk['section'] != 'skill']
    return ' '.join(texts)[:DOCUMENT_TEXT_MAX_CHARS]


def content_hash(value):
    payload = json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def read_uploaded_cv_text(cv):
    """Chữ của tệp CV tải lên (DOCX được đổi sang PDF trước khi đọc)."""
    source = open_uploaded_cv_pdf(cv)
    if source is None:
        raise ExtractionError('cv_text_unavailable')
    with source:
        return extract_cv_text(source, 'pdf')


def job_content_hash(job):
    """Hash của hồ sơ tin; đổi khi nội dung hay trường có cấu trúc của tin đổi.

    Ném `ExtractionError` nếu tin không đủ nội dung để phân tích.
    """
    return content_hash({'extractor': EXTRACTOR_VERSION, 'profile': job_profile(job)})


def _cv_source(cv_version):
    """(hash nội dung, hàm tạo hồ sơ) của một phiên bản CV."""
    cv = cv_version.cv
    if cv.cv_type == UserCv.CvType.UPLOADED:
        digest = content_hash({'file': cv.file_url, 'type': cv.file_type})
        return digest, lambda catalog: text_cv_profile(read_uploaded_cv_text(cv), catalog)
    digest = content_hash(cv_version.content_json)
    return digest, lambda catalog: cv_profile(cv_version.content_json, catalog)


def _existing(kind, source, digest, model_version):
    return (
        MatchDocument.objects.filter(
            kind=kind,
            content_hash=digest,
            extractor_version=EXTRACTOR_VERSION,
            model_version=model_version,
            **source,
        )
        .order_by('-pk')
        .first()
    )


def _store(kind, source, digest, build_profile, encoder):
    """Tạo hàng tài liệu (và chunk kèm vector) nếu chưa có; trả hàng đã có nếu trùng khóa."""
    document = _existing(kind, source, digest, encoder.version)
    if document is not None:
        return document
    try:
        profile, error_code = build_profile(), ''
    except (ExtractionError, CvDocumentRejected) as error:
        profile, error_code = {}, error.code
    chunks = profile.get('chunks', [])
    vectors = encoder.encode([chunk['text'] for chunk in chunks], kind=ENCODE_KIND[kind])
    text = document_text(profile)
    embedding = encoder.encode([text], kind=ENCODE_KIND[kind])[0].tolist() if text else None
    try:
        with transaction.atomic():
            document = MatchDocument.objects.create(
                kind=kind,
                content_hash=digest,
                language=profile.get('language', ''),
                profile_json=profile,
                embedding=embedding,
                extractor_version=EXTRACTOR_VERSION,
                model_version=encoder.version,
                status=MatchDocument.Status.FAILED if error_code else MatchDocument.Status.READY,
                error_code=error_code,
                **source,
            )
            MatchChunk.objects.bulk_create(
                MatchChunk(
                    document=document,
                    position=chunk['index'],
                    section=chunk['section'],
                    text=chunk['text'],
                    embedding=vector.tolist(),
                )
                for chunk, vector in zip(chunks, vectors, strict=True)
            )
    except IntegrityError:
        # Một worker khác vừa tạo cùng tài liệu.
        document = _existing(kind, source, digest, encoder.version)
    return document


def ensure_cv_document(cv_version, *, encoder, catalog):
    digest, build = _cv_source(cv_version)
    return _store(
        MatchDocument.Kind.CV, {'cv_version': cv_version}, digest, lambda: build(catalog), encoder
    )


def ensure_job_document(job, *, encoder):
    """`job` cần nạp sẵn quan hệ bằng selector `jobs_for_profile`."""
    try:
        digest = job_content_hash(job)
    except ExtractionError:
        digest = content_hash({'extractor': EXTRACTOR_VERSION, 'job': job.pk, 'invalid': True})
    return _store(MatchDocument.Kind.JOB, {'job': job}, digest, lambda: job_profile(job), encoder)


def chunk_vectors(document):
    """(chunk theo thứ tự, ma trận vector tương ứng) của một tài liệu."""
    chunks = list(document.chunks.order_by('position'))
    matrix = np.array([chunk.embedding for chunk in chunks], dtype=np.float32)
    return chunks, matrix.reshape(len(chunks), -1)
