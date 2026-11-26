"""Tìm ứng viên cho một tin (Tìm CV): xếp các CV đang bật tìm kiếm theo mức phù hợp.

Bên gọi (app `applications`) quyết định **ai** được tìm thấy: CV đang bật, ứng viên
còn đồng ý, không bị chặn. Module này quyết định **thứ tự** và **phần được hiển thị**:

1. Lọc theo trường của hồ sơ trích xuất (kỹ năng, khoảng kinh nghiệm, học vấn, cấp bậc,
   ngoại ngữ và mức, chức danh, trường học, từ khóa trong nội dung CV) bằng tra cứu JSON
   trên `MatchDocument.profile_json`. Từ khóa chỉ quét chức danh và các mục được hiển
   thị cho NTD (không quét mục `other`), để không dò được phần bị ẩn.
2. Lấy `SEARCH_POOL` CV gần vector của tin nhất bằng pgvector (tìm chính xác).
3. Chấm từng CV bằng đúng công thức đang chạy (`score_match`, `hybrid-v3`). Vector của
   tin và CV đã tính sẵn, nên tiến trình web không cần nạp mô hình. Chỉ truyền chunk
   chức danh: phần so từng câu yêu cầu không ảnh hưởng tới điểm và không được hiển thị
   ở đây.
4. Trả kết quả đã ẩn danh: hồ sơ qua `public_cv_profile(audience=recruiter_search)` (nội
   dung từng mục của CV, không có email, số điện thoại, phần đầu trang hay mục chưa phân
   loại) và che họ tên xuất hiện trong câu văn; kết quả chấm không kèm câu bằng chứng.

Không tìm bằng câu tự do: muốn so ngữ nghĩa một câu truy vấn phải mã hóa nó bằng mô
hình, mà tiến trình web không có mô hình. Tin tuyển dụng là "câu truy vấn" đã mã hóa sẵn.
"""

from dataclasses import dataclass

import numpy as np
from django.db.models import F, Func, JSONField, Q, TextField, Value
from django.db.models.functions import Cast
from pgvector.django import CosineDistance

from apps.cvs.services import EDUCATION_ORDER
from apps.jobs.models import JobLanguageRequirement
from apps.sitecontent.selectors import get_bool_setting

from ..domain import (
    CANDIDATE_SEARCH_FLAG,
    RECRUITER_SEARCH,
    public_cv_profile,
    redact_name,
    search_card,
)
from ..models import MatchDocument, current_documents, title_vectors
from .extraction.facts import looks_like_job_title
from .scoring import ScoringError, score_match

# Số CV gần tin nhất được chấm cho một lần tìm.
SEARCH_POOL = 200
# Dưới mức này CV không vào kết quả: cặp khác ngành có trung vị 11 điểm trên validation.
MIN_SEARCH_SCORE = 30
MAX_LISTED_SKILLS = 6


LANGUAGE_LEVELS = tuple(JobLanguageRequirement.ProficiencyLevel.values)
# Giá trị (không có khóa JSON) của các mục CV mà NTD tìm kiếm được xem.
SHOWN_TEXT_PATH = 'lax $.sections[*] ? (@.key != "other").items[*].*'
EDUCATION_TEXT_PATH = 'lax $.sections[*] ? (@.key == "education").items[*].*'


@dataclass(frozen=True)
class ProfileFilters:
    """Bộ lọc theo hồ sơ trích xuất. Trường để trống thì không lọc.

    `keyword`, `all_keywords`, `any_keywords`, `none_keywords`: so trong chức danh và nội
    dung CV được hiển thị (không phân biệt hoa thường). `title`: chỉ trong chức danh.
    `school`: trong mục học vấn. `language_level`: mức tối thiểu của `language`.
    """

    skill_ids: tuple = ()
    min_months: int | None = None
    max_months: int | None = None
    education: str = ''
    position_level: str = ''
    language: str = ''
    language_level: str = ''
    keyword: str = ''
    title: str = ''
    school: str = ''
    all_keywords: tuple = ()
    any_keywords: tuple = ()
    none_keywords: tuple = ()

    @property
    def uses_text(self):
        return bool(self.keyword or self.all_keywords or self.any_keywords or self.none_keywords)


def candidate_search_enabled():
    return get_bool_setting(CANDIDATE_SEARCH_FLAG, default=False)


class _JsonPathValues(Func):
    """`jsonb_path_query_array(cột, đường dẫn)` → mảng JSON các giá trị khớp đường dẫn."""

    function = 'jsonb_path_query_array'
    output_field = JSONField()


def _path_text(path):
    return Cast(_JsonPathValues(F('profile_json'), Value(path)), TextField())


def _mentions(keyword):
    return Q(profile_json__title__icontains=keyword) | Q(search_text__icontains=keyword)


def _filtered_text(documents, filters):
    if filters.uses_text:
        documents = documents.annotate(search_text=_path_text(SHOWN_TEXT_PATH))
    for keyword in (filters.keyword, *filters.all_keywords):
        if keyword:
            documents = documents.filter(_mentions(keyword))
    if filters.any_keywords:
        any_of = Q()
        for keyword in filters.any_keywords:
            any_of |= _mentions(keyword)
        documents = documents.filter(any_of)
    for keyword in filters.none_keywords:
        documents = documents.exclude(_mentions(keyword))
    if filters.school:
        documents = documents.annotate(education_text=_path_text(EDUCATION_TEXT_PATH)).filter(
            education_text__icontains=filters.school
        )
    if filters.title:
        documents = documents.filter(profile_json__title__icontains=filters.title)
    return documents


def _filtered(documents, filters):
    for skill_id in filters.skill_ids:
        documents = documents.filter(profile_json__skills__contains=[{'skill_id': skill_id}])
    if filters.min_months is not None:
        documents = documents.filter(profile_json__experience__months__gte=filters.min_months)
    if filters.max_months is not None:
        documents = documents.filter(profile_json__experience__months__lte=filters.max_months)
    if filters.education in EDUCATION_ORDER:
        at_least = EDUCATION_ORDER[EDUCATION_ORDER.index(filters.education) :]
        documents = documents.filter(profile_json__education__level__in=at_least)
    if filters.position_level:
        documents = documents.filter(profile_json__position_level=filters.position_level)
    if filters.language and filters.language_level in LANGUAGE_LEVELS:
        at_least = LANGUAGE_LEVELS[LANGUAGE_LEVELS.index(filters.language_level) :]
        spoken = Q()
        for level in at_least:
            spoken |= Q(
                profile_json__languages__contains=[{'code': filters.language, 'level': level}]
            )
        documents = documents.filter(spoken)
    elif filters.language:
        documents = documents.filter(profile_json__languages__contains=[{'code': filters.language}])
    return _filtered_text(documents, filters)


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


def _search_profile(profile, full_name):
    """Hồ sơ ẩn danh: không có mục `other`, họ tên trong câu văn bị che.

    Chức danh của CV tải lên chỉ giữ khi đúng là một chức danh nghề (dòng đầu trang có thể
    là tên người).
    """
    shown = redact_name(public_cv_profile(profile, audience=RECRUITER_SEARCH), full_name)
    if profile.get('source') == 'upload' and not looks_like_job_title(shown['title']):
        shown['title'] = ''
    return shown


def rank_cvs_for_job(job, cv_version_ids, *, filters=None, min_score=MIN_SEARCH_SCORE):
    """Các CV phù hợp với `job`, điểm cao trước; None nếu tin chưa có vector.

    `cv_version_ids`: phiên bản mới nhất của các CV được phép tìm thấy (queryset hoặc
    danh sách id). Mỗi phần tử trả về: `{cv_version_id, score, level, matched_skills,
    job_skill_count, profile, card, result}`; `card` là tóm tắt cho thẻ danh sách; `result` là kết quả chấm đã ẩn danh (cho màn
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
        .values(
            'pk', 'cv_version_id', 'profile_json', 'embedding', 'cv_version__cv__user__full_name'
        )[:SEARCH_POOL]
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
        profile = _search_profile(row['profile_json'], row['cv_version__cv__user__full_name'])
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
                'profile': profile,
                'card': search_card(profile),
                'result': _anonymised_result(result),
            }
        )
    ranked.sort(key=lambda item: (-item['score'], item['cv_version_id']))
    return ranked
