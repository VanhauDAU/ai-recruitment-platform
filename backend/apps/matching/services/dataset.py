"""Xuất `profile_json` của CV và tin ra JSONL cho các script thực nghiệm ở `ml/`.

Chỉ đọc, không ghi DB. CV chỉ lấy theo một tên miền email (mặc định tài khoản
CV tổng hợp), nên không xuất CV của người dùng thật.
"""

from pathlib import Path

from apps.cvs.services import CvDocumentRejected, extract_cv_text, open_uploaded_cv_pdf

from .extraction import EXTRACTOR_VERSION, ExtractionError, cv_profile, job_profile, text_cv_profile
from .skills import SkillCatalog

FILE_TYPES = {'.pdf': 'pdf', '.docx': 'docx'}


def _text_profile(read, catalog):
    try:
        return {'profile': text_cv_profile(read(), catalog)}
    except (CvDocumentRejected, ExtractionError) as error:
        return {'error': error.code}


def _read_upload(cv):
    source = open_uploaded_cv_pdf(cv)
    if source is None:
        raise ExtractionError('cv_text_unavailable')
    with source:
        return extract_cv_text(source, 'pdf')


def _read_file(path):
    with path.open('rb') as source:
        return extract_cv_text(source, FILE_TYPES[path.suffix.lower()])


def export_skills(catalog=None):
    """Danh mục kỹ năng (tên, alias, nhóm) để script đánh giá quy tên về tên chuẩn."""
    catalog = catalog or SkillCatalog.load()
    for skill, terms in catalog.terms_by_skill():
        yield {'skill_id': skill.id, 'name': skill.name, 'group': skill.group, 'terms': terms}


def export_jobs(jobs):
    """`jobs` nạp sẵn quan hệ bằng selector `jobs_for_profile`."""
    for job in jobs:
        row = {'job_public_id': job.public_id, 'slug': job.slug}
        try:
            row['profile'] = job_profile(job)
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
            row.update(_text_profile(lambda cv=cv: _read_upload(cv), catalog))
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
