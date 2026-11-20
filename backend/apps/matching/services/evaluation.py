"""Chấm một danh sách cặp CV–tin bằng đúng mã của sản phẩm mà không ghi DB.

Dùng cho thực nghiệm ở `ml/` (lệnh `matching_evaluate`). Các bước giống hệt lúc
ứng viên bấm "Xem độ phù hợp": trích xuất hồ sơ → mã hóa → `score_match`. Khác ở
hai điểm: kết quả được trả về thay vì lưu, và tiêu chí địa điểm tắt vì rubric gán
nhãn không xét địa điểm. Nhờ vậy số liệu trong báo cáo đo đúng thứ đang chạy, và
muốn thử mô hình khác chỉ cần truyền encoder khác.
"""

from apps.cvs.services import CvDocumentRejected

from ..models import MatchDocument
from .documents import cv_source, encode_profile
from .extraction import ExtractionError, job_profile
from .scoring import ScoringError, score_match


def _encoded(profile, kind, encoder):
    vectors, embedding = encode_profile(profile, kind, encoder)
    chunks = [{'section': chunk['section'], 'text': chunk['text']} for chunk in profile['chunks']]
    return {'profile': profile, 'chunks': chunks, 'vectors': vectors, 'embedding': embedding}


def _cv_profile(cv, catalog):
    if cv.latest_version is None:
        raise ExtractionError('cv_without_version')
    return cv_source(cv.latest_version)[1](catalog)


def evaluate_pairs(pairs, *, encoder, catalog):
    """Sinh một dòng kết quả cho mỗi cặp `(job, cv)`.

    `job` nạp bằng `models.jobs_for_profile`, `cv` bằng `selectors.cvs_for_profile`.
    Mỗi tin và mỗi CV chỉ được trích xuất và mã hóa một lần. Dòng kết quả có điểm
    tổng, điểm từng tiêu chí và hai cosine thô (toàn văn, chức danh); cặp không
    chấm được mang `error` là mã lỗi.
    """
    sides = {}

    def side(key, kind, build):
        if key not in sides:
            try:
                sides[key] = _encoded(build(), kind, encoder)
            except (ExtractionError, CvDocumentRejected) as error:
                sides[key] = error.code
        return sides[key]

    for job, cv in pairs:
        job_side = side(('job', job.pk), MatchDocument.Kind.JOB, lambda job=job: job_profile(job))
        cv_side = side(('cv', cv.pk), MatchDocument.Kind.CV, lambda cv=cv: _cv_profile(cv, catalog))
        failed = next((value for value in (job_side, cv_side) if isinstance(value, str)), None)
        if failed is not None:
            yield {'error': failed}
            continue
        try:
            result = score_match(
                cv_side['profile'],
                job_side['profile'],
                cv_chunks=cv_side['chunks'],
                cv_vectors=cv_side['vectors'],
                job_chunks=job_side['chunks'],
                job_vectors=job_side['vectors'],
                cv_document_vector=cv_side['embedding'],
                job_document_vector=job_side['embedding'],
                model_version=encoder.version,
                include_location=False,
            )
        except ScoringError as error:
            yield {'error': error.code}
            continue
        components = {component['key']: component for component in result['components']}
        relevance = components['experience']['detail']
        yield {
            'score': result['overall']['score'],
            'level': result['overall']['level'],
            'confidence': result['overall']['confidence'],
            'components': {key: component['score'] for key, component in components.items()},
            'document_similarity': relevance.get('document_similarity'),
            'title_similarity': relevance.get('title_similarity'),
        }
