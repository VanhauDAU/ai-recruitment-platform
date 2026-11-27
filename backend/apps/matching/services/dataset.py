"""Xuất `profile_json` của CV và tin ra JSONL cho các script thực nghiệm ở `ml/`.

Chỉ đọc, không ghi DB. CV chỉ lấy theo một tên miền email (mặc định tài khoản
CV tổng hợp), nên không xuất CV của người dùng thật.
"""

from pathlib import Path

from apps.cv_templates.models import CvLanguage
from apps.cvs.services import CvDocumentRejected, cv_content_from_generated, extract_cv_text

from .documents import document_text, read_uploaded_cv_text
from .extraction import (
    EXTRACTOR_VERSION,
    ExtractionError,
    cv_profile,
    job_profile,
    job_text_chunks,
    text_cv_profile,
)
from .extraction.facts import requirement_kind
from .skills import SkillCatalog

FILE_TYPES = {'.pdf': 'pdf', '.docx': 'docx'}


def _text_profile(read, catalog):
    try:
        return {'profile': text_cv_profile(read(), catalog)}
    except (CvDocumentRejected, ExtractionError) as error:
        return {'error': error.code}


def _read_file(path):
    with path.open('rb') as source:
        return extract_cv_text(source, FILE_TYPES[path.suffix.lower()])


def export_skills(catalog=None):
    """Danh mục kỹ năng (tên, alias, nhóm) để script đánh giá quy tên về tên chuẩn."""
    catalog = catalog or SkillCatalog.load()
    for skill, terms in catalog.terms_by_skill():
        yield {'skill_id': skill.id, 'name': skill.name, 'group': skill.group, 'terms': terms}


def export_jobs(jobs):
    """`jobs` nạp sẵn quan hệ bằng `models.jobs_for_profile`."""
    for job in jobs:
        row = {'job_public_id': job.public_id, 'slug': job.slug}
        try:
            row['profile'] = job_profile(job)
            # Văn bản toàn văn mà mô hình mã hóa thành vector tài liệu của tin.
            row['text'] = document_text(row['profile'])
            row['requirements'] = _requirements(row['profile']['chunks'])
        except ExtractionError as error:
            row['error'] = error.code
        yield {'extractor_version': EXTRACTOR_VERSION, **row}


def export_cvs(cvs, catalog=None):
    """`cvs` từ selector `cvs_for_profile` (lọc theo tên miền email)."""
    catalog = catalog or SkillCatalog.load()
    for cv in cvs:
        row = {
            'code': cv.user.email.split('@', 1)[0].upper(),
            'cv_id': cv.pk,
            'cv_type': cv.cv_type,
        }
        if cv.cv_type == cv.CvType.UPLOADED:
            row.update(_text_profile(lambda cv=cv: read_uploaded_cv_text(cv), catalog))
        elif cv.latest_version is not None:
            row['version_id'] = cv.latest_version.pk
            row['profile'] = cv_profile(cv.latest_version.content_json, catalog)
        else:
            row['error'] = 'cv_without_version'
        yield {'extractor_version': EXTRACTOR_VERSION, **row}


def export_files(directory, catalog=None):
    catalog = catalog or SkillCatalog.load()
    for path in sorted(Path(directory).iterdir()):
        if path.suffix.lower() in FILE_TYPES:
            row = {'file': path.name, **_text_profile(lambda path=path: _read_file(path), catalog)}
            yield {'extractor_version': EXTRACTOR_VERSION, **row}


_CV_LOCALES = {'vi': CvLanguage.VI, 'en': CvLanguage.EN}


def _requirements(chunks):
    """Câu yêu cầu của tin kèm loại (`facts.requirement_kind`)."""
    return [
        {'text': chunk['text'], 'kind': requirement_kind(chunk['text'])}
        for chunk in chunks
        if chunk['section'] == 'requirement'
    ]


def export_texts(items, catalog=None):
    """Văn bản mà mô hình sẽ thấy của các tài liệu nằm ngoài DB (dữ liệu huấn luyện).

    Mỗi `item` là `{id, kind: 'cv', language, data}` (CV dựng sẵn như của
    `import_cv_documents`) hoặc `{id, kind: 'job', title, description, requirements}`.
    Trả `{id, title, text, chunks}`: `title` là chunk chức danh, `text` là văn bản
    toàn văn dùng cho vector tài liệu, `chunks` là các câu kèm mục. Dùng đúng hàm
    dựng chunk của sản phẩm, nên mô hình được huấn luyện trên đúng dạng văn bản nó
    gặp lúc chạy.
    """
    catalog = catalog or SkillCatalog.load()
    for item in items:
        try:
            if item['kind'] == 'cv':
                content = cv_content_from_generated(item['data'], _CV_LOCALES[item['language']])
                chunks = cv_profile(content, catalog)['chunks']
            else:
                chunks, _ = job_text_chunks(
                    item['title'], item.get('description', ''), item.get('requirements', '')
                )
        except ExtractionError as error:
            yield {'id': item['id'], 'error': error.code}
            continue
        yield {
            'id': item['id'],
            'requirements': _requirements(chunks),
            'title': next((chunk['text'] for chunk in chunks if chunk['section'] == 'title'), ''),
            'text': document_text({'chunks': chunks}),
            'chunks': [{'section': chunk['section'], 'text': chunk['text']} for chunk in chunks],
        }
