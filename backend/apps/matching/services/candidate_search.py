"""Tìm ứng viên cho một tin (Tìm CV): xếp các CV đang bật tìm kiếm theo mức phù hợp.

Bên gọi (app `applications`) quyết định **ai** được tìm thấy: CV đang bật, ứng viên
còn đồng ý, không bị chặn. Module này quyết định **thứ tự** và **phần được hiển thị**:

1. Lọc theo trường của hồ sơ trích xuất (kỹ năng, số tháng kinh nghiệm, học vấn, ngoại
   ngữ, từ khóa chức danh) bằng tra cứu JSON trên `MatchDocument.profile_json`.
2. Lấy `SEARCH_POOL` CV gần vector của tin nhất bằng pgvector (tìm chính xác).
3. Chấm từng CV bằng đúng công thức đang chạy (`score_match`, `hybrid-v2`). Vector của
   tin và CV đã tính sẵn, nên tiến trình web không cần nạp mô hình. Chỉ truyền chunk
   chức danh: phần so từng câu yêu cầu không ảnh hưởng tới điểm và không được hiển thị
   ở đây.
4. Trả kết quả đã ẩn danh: hồ sơ qua `public_cv_profile(audience=recruiter_search)`,
   không có câu trích nguyên văn nào của CV.

Không tìm bằng câu tự do: muốn so ngữ nghĩa một câu truy vấn phải mã hóa nó bằng mô
hình, mà tiến trình web không có mô hình. Tin tuyển dụng là "câu truy vấn" đã mã hóa sẵn.
"""

from dataclasses import dataclass

import numpy as np
from pgvector.django import CosineDistance

from apps.cvs.services import EDUCATION_ORDER
from apps.sitecontent.selectors import get_bool_setting

from ..domain import CANDIDATE_SEARCH_FLAG, RECRUITER_SEARCH, public_cv_profile
from ..models import MatchDocument, current_documents, title_vectors
from .extraction.facts import looks_like_job_title
from .scoring import ScoringError, score_match

# Số CV gần tin nhất được chấm cho một lần tìm.
SEARCH_POOL = 200
# Dưới mức này CV không vào kết quả: cặp khác ngành có trung vị 11 điểm trên validation.
MIN_SEARCH_SCORE = 30
MAX_LISTED_SKILLS = 6


@dataclass(frozen=True)
class ProfileFilters:
    """Bộ lọc theo hồ sơ trích xuất. Trường để trống thì không lọc."""

    skill_ids: tuple = ()
    min_months: int | None = None
    education: str = ''
    language: str = ''
    keyword: str = ''


def candidate_search_enabled():
    return get_bool_setting(CANDIDATE_SEARCH_FLAG, default=False)


def _filtered(documents, filters):
    for skill_id in filters.skill_ids:
        documents = documents.filter(profile_json__skills__contains=[{'skill_id': skill_id}])
    if filters.min_months is not None:
        documents = documents.filter(profile_json__experience__months__gte=filters.min_months)
    if filters.education in EDUCATION_ORDER:
        at_least = EDUCATION_ORDER[EDUCATION_ORDER.index(filters.education) :]
        documents = documents.filter(profile_json__education__level__in=at_least)
    if filters.language:
        documents = documents.filter(profile_json__languages__contains=[{'code': filters.language}])
    if filters.keyword:
        documents = documents.filter(profile_json__title__icontains=filters.keyword)
    return documents


def _title_chunk(vector):
    """Chunk và ma trận vector chỉ gồm chức danh (đủ cho mức liên quan của `score_match`)."""
    if vector is None:
        return [], np.zeros((0, 0), dtype=np.float32)
    return [{'section': 'title', 'text': ''}], vector.reshape(1, -1)


def _anonymised_result(result):
    """Kết quả chấm không còn chữ nguyên văn của CV: bỏ câu bằng chứng và mục yêu cầu."""
    matched = [{**skill, 'evidence': ''} for skill in result['skills']['matched']]
    components = [
        {**component, 'detail': {**component['detail'], 'matched': matched}}
        if component['key'] == 'skills' and 'matched' in component['detail']
        else component
        for component in result['components']
    ]
    return {
        **result,
        'components': components,
        'skills': {**result['skills'], 'matched': matched},
        'requirements': [],
    }


def _search_profile(profile):
    """Hồ sơ ẩn danh; chức danh của CV tải lên chỉ giữ khi đúng là một chức danh nghề."""
    shown = public_cv_profile(profile, audience=RECRUITER_SEARCH)
    if profile.get('source') == 'upload' and not looks_like_job_title(shown['title']):
        shown['title'] = ''
    return shown


def rank_cvs_for_job(job, cv_version_ids, *, filters=None, min_score=MIN_SEARCH_SCORE):
    """Các CV phù hợp với `job`, điểm cao trước; None nếu tin chưa có vector.

    `cv_version_ids`: phiên bản mới nhất của các CV được phép tìm thấy (queryset hoặc
    danh sách id). Mỗi phần tử trả về: `{cv_version_id, score, level, matched_skills,
    job_skill_count, profile, result}`; `result` là kết quả chấm đã ẩn danh (cho màn
    xem nhanh), `profile` là hồ sơ trích xuất ẩn danh. Số truy vấn cố định: tài liệu
    của tin, các CV gần nhất, vector chức danh.
    """
    job_document = current_documents(MatchDocument.Kind.JOB).filter(job=job).first()
    if job_document is None:
        return None
    job_vector = np.asarray(job_document.embedding, dtype=np.float32)
    documents = _filtered(
        current_documents(MatchDocument.Kind.CV).filter(cv_version_id__in=cv_version_ids),
        filters or ProfileFilters(),
    )
    rows = list(
        documents.annotate(distance=CosineDistance('embedding', job_vector))
        .order_by('distance', 'pk')
        .values('pk', 'cv_version_id', 'profile_json', 'embedding')[:SEARCH_POOL]
    )
    titles = title_vectors([job_document.pk, *(row['pk'] for row in rows)])
    job_chunks, job_vectors = _title_chunk(titles.get(job_document.pk))
    job_skill_count = sum(1 for skill in job_document.profile_json['skills'] if skill['counted'])

    ranked = []
    for row in rows:
        cv_chunks, cv_vectors = _title_chunk(titles.get(row['pk']))
        try:
            result = score_match(
                row['profile_json'],
                job_document.profile_json,
                cv_chunks=cv_chunks,
                cv_vectors=cv_vectors,
                job_chunks=job_chunks,
                job_vectors=job_vectors,
                cv_document_vector=np.asarray(row['embedding'], dtype=np.float32),
                job_document_vector=job_vector,
                model_version=job_document.model_version,
            )
        except ScoringError:
            continue
        if result['overall']['score'] < min_score:
            continue
        ranked.append(
            {
                'cv_version_id': row['cv_version_id'],
                'score': result['overall']['score'],
                'level': result['overall']['level'],
                'matched_skills': [skill['name'] for skill in result['skills']['matched']][
                    :MAX_LISTED_SKILLS
                ],
                'matched_skill_count': len(result['skills']['matched']),
                'job_skill_count': job_skill_count,
                'profile': _search_profile(row['profile_json']),
                'result': _anonymised_result(result),
            }
        )
    ranked.sort(key=lambda item: (-item['score'], item['cv_version_id']))
    return ranked
