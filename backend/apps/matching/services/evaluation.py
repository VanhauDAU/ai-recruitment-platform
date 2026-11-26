"""Chấm một danh sách cặp CV–tin bằng đúng mã của sản phẩm mà không ghi DB.

Dùng cho thực nghiệm ở `ml/` (lệnh `matching_evaluate`). Các bước giống hệt lúc
ứng viên bấm "Xem độ phù hợp": trích xuất hồ sơ → mã hóa → `score_match`. Khác ở
một điểm: kết quả được trả về thay vì lưu. Nhờ vậy số liệu trong báo cáo đo đúng
thứ đang chạy, và muốn thử mô hình khác chỉ cần truyền encoder khác.
"""

from dataclasses import dataclass, replace

from apps.cv_templates.models import CvLanguage
from apps.cvs.services import CvDocumentRejected, cv_content_from_generated

from ..domain import calibration_for
from ..models import MatchDocument
from .documents import cv_source, encode_profile
from .extraction import ExtractionError, cv_profile, job_profile
from .scoring import ScoringError, score_match


@dataclass(frozen=True)
class InlineCv:
    """CV nằm ngoài DB (CV của tập hiệu chỉnh): `pk` là mã, `content` là nội dung CV dựng sẵn."""

    pk: str
    content: dict


_CV_LOCALES = {'vi': CvLanguage.VI, 'en': CvLanguage.EN}


def inline_cv(item):
    """`InlineCv` từ một CV dựng sẵn `{id, language, data}` (dạng của `import_cv_documents`)."""
    content = cv_content_from_generated(item['data'], _CV_LOCALES[item['language']])
    return InlineCv(item['id'], content)


def _encoded(profile, kind, encoder):
    vectors, embedding = encode_profile(profile, kind, encoder)
    chunks = [{'section': chunk['section'], 'text': chunk['text']} for chunk in profile['chunks']]
    return {'profile': profile, 'chunks': chunks, 'vectors': vectors, 'embedding': embedding}


def _cv_profile(cv, catalog):
    if isinstance(cv, InlineCv):
        return cv_profile(cv.content, catalog)
    if cv.latest_version is None:
        raise ExtractionError('cv_without_version')
    return cv_source(cv.latest_version)[1](catalog)


def evaluate_pairs(
    pairs, *, encoder, catalog, detail=False, ablation=(), marks=None, reranker=None
):
    """Sinh một dòng kết quả cho mỗi cặp `(job, cv)`.

    `job` nạp bằng `models.jobs_for_profile`, `cv` bằng `selectors.cvs_for_profile`.
    Mỗi tin và mỗi CV chỉ được trích xuất và mã hóa một lần. Dòng kết quả có điểm
    tổng, điểm từng tiêu chí và hai cosine thô (toàn văn, chức danh); cặp không
    chấm được mang `error` là mã lỗi. `detail=True` kèm nguyên kết quả của
    `score_match` (kỹ năng khớp/thiếu, chi tiết từng tiêu chí) để phân tích lỗi.
    `ablation` tắt từng thay đổi của công thức (`scoring.ABLATIONS`) để đo riêng.
    `cv` có thể là `InlineCv` để chấm CV không có trong DB. `marks` là
    `{tên: {'document': (low, high), 'title': (low, high)}}`: mỗi bộ mốc quy đổi cosine
    được chấm thêm một lượt trên cùng vector, kết quả nằm ở `variants` (dùng khi dò mốc).
    `reranker` là cross-encoder; không truyền thì chấm như khi không có nó.
    """
    variants = {
        name: replace(calibration_for(encoder.version), document=tuple(value['document']), title=tuple(value['title']))
        for name, value in (marks or {}).items()
    }  # fmt: skip
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
        inputs = {
            'cv_chunks': cv_side['chunks'],
            'cv_vectors': cv_side['vectors'],
            'job_chunks': job_side['chunks'],
            'job_vectors': job_side['vectors'],
            'cv_document_vector': cv_side['embedding'],
            'job_document_vector': job_side['embedding'],
            'model_version': encoder.version,
            'catalog': catalog,
            'ablation': ablation,
            'reranker': reranker,
        }
        try:
            result = score_match(cv_side['profile'], job_side['profile'], **inputs)
            scored = {
                name: score_match(cv_side['profile'], job_side['profile'], calibration=value, **inputs)['overall']['score']
                for name, value in variants.items()
            }  # fmt: skip
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
            **({'variants': scored} if variants else {}),
            **({'result': result} if detail else {}),
        }
