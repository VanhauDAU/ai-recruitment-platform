"""Bước 4 của đối sánh: chấm điểm một cặp CV–tin theo công thức `hybrid-v2`.

| Tệp | Việc |
| --- | --- |
| `semantic.py` | Cosine, hiệu chuẩn cosine → 0–100, MaxSim cho câu bằng chứng |
| `criteria.py` | Năm tiêu chí (kỹ năng, kinh nghiệm, học vấn, cấp bậc, ngoại ngữ) |
| `engine.py` | Mức liên quan (toàn văn + chức danh), ghép câu bằng chứng, cộng điểm có trọng số, mức và độ tin cậy |

Điểm tổng là trung bình có trọng số của các tiêu chí tính được; tiêu chí thiếu
dữ liệu hoặc tin không yêu cầu bị loại và trọng số được chuẩn hóa lại. Hai luật
áp lên điểm tổng:

- **Hệ số liên quan.** Học vấn, cấp bậc, ngoại ngữ là điểm "đủ điều kiện chung":
  người khác nghề vẫn đạt. Phần đóng góp của ba tiêu chí này vào điểm tổng được
  nhân với `min(1, R / RELEVANCE_FULL)`, R là mức liên quan 0–100 giữa CV và tin.
  Điểm hiển thị của từng tiêu chí giữ nguyên giá trị thật ("đủ bậc học" vẫn là
  100); chỉ phần cộng vào điểm tổng bị giảm. Cùng ý với tiêu chí kinh nghiệm, nơi
  số năm được nhân với R/100.
- **Trần ngoại ngữ.** Thiếu ngoại ngữ bắt buộc thì điểm tổng tối đa 64 (mức
  "Tương đối phù hợp").

Khác `hybrid-v1` (số đo ở `ml/reports/eval_validation.md`): bỏ tiêu chí địa điểm
(CV không mang địa điểm, rubric không xét), tắt khớp kỹ năng "viết khác tên" với
mô hình chưa fine-tune (xem `domain/calibration.py`), thêm hệ số liên quan.
`ABLATIONS` cho phép tắt từng thay đổi để đo riêng phần đóng góp của nó; sản phẩm
luôn chạy với `ablation=()`.
"""

from . import criteria
from .criteria import EXPERIENCE_SECTIONS, MatchInput
from .semantic import best_matches, calibration_for, cosine, requirement_status, to_score

SCORING_VERSION = 'hybrid-v2'
RESULT_SCHEMA_VERSION = 2
WEIGHTS = {
    'skills': 0.40,
    'experience': 0.30,
    'education': 0.10,
    'position_level': 0.10,
    'languages': 0.10,
}
# Tiêu chí "đủ điều kiện chung": chỉ được tính đủ vào điểm tổng khi CV đúng lĩnh vực.
GENERIC_CRITERIA = ('education', 'position_level', 'languages')
# Mức liên quan R từ đó ba tiêu chí trên được tính đủ: giữa thang hiệu chuẩn (0 là
# trung vị cặp khác ngành, 100 là phân vị 90 cặp khớp mạnh). Chọn trên validation.
RELEVANCE_FULL = 50
# Tên các thay đổi của `hybrid-v2` có thể tắt khi đo (lệnh `matching_evaluate`).
ABLATIONS = ('semantic_skills', 'no_relevance_discount')
LANGUAGE_REQUIRED_CAP = 64
LEVELS = (
    (80, 'very_high', 'Rất phù hợp'),
    (65, 'high', 'Phù hợp'),
    (50, 'medium', 'Tương đối phù hợp'),
    (0, 'low', 'Chưa phù hợp'),
)
# Câu CV không dùng để nhận kỹ năng viết khác tên: "Tiếng Anh: Giao tiếp" không
# phải kỹ năng giao tiếp.
SKILL_EXCLUDED_SECTIONS = ('languages',)


class ScoringError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _hits(job_chunks, job_vectors, cv_chunks, cv_vectors, *, section, cv_sections=None):
    rows = [index for index, chunk in enumerate(job_chunks) if chunk['section'] == section]
    allowed = [
        index
        for index, chunk in enumerate(cv_chunks)
        if (cv_sections is None and chunk['section'] not in SKILL_EXCLUDED_SECTIONS)
        or (cv_sections is not None and chunk['section'] in cv_sections)
    ]
    if cv_sections is not None and not allowed:
        allowed = list(range(len(cv_chunks)))
    best = best_matches(job_vectors[rows], cv_vectors[allowed]) if rows else []
    return [
        (
            job_chunks[row]['text'],
            similarity,
            cv_chunks[allowed[index]]['text'] if index is not None else '',
        )
        for row, (index, similarity) in zip(rows, best, strict=True)
    ]


def _level(score):
    return next((key, label) for minimum, key, label in LEVELS if score >= minimum)


def _title_index(chunks):
    return next((index for index, chunk in enumerate(chunks) if chunk['section'] == 'title'), None)


def _relevance(cv_chunks, cv_vectors, job_chunks, job_vectors, cv_document_vector, job_document_vector, calibration):  # fmt: skip
    """Mức liên quan 0–100: trung bình điểm toàn văn và điểm chức danh (phép nào so được)."""
    scores, detail = [], {}
    if cv_document_vector is not None and job_document_vector is not None:
        detail['document_similarity'] = cosine(job_document_vector, cv_document_vector)
        scores.append(to_score(detail['document_similarity'], calibration.document))
    cv_title, job_title = _title_index(cv_chunks), _title_index(job_chunks)
    if cv_title is not None and job_title is not None:
        detail['title_similarity'] = cosine(job_vectors[job_title], cv_vectors[cv_title])
        scores.append(to_score(detail['title_similarity'], calibration.title))
    return (sum(scores) / len(scores) if scores else None), detail


def _relevance_factor(relevance):
    """Hệ số 0–1 nhân vào phần đóng góp của các tiêu chí chung; không so được thì 1."""
    if relevance is None:
        return 1.0
    return min(1.0, relevance / RELEVANCE_FULL)


def score_match(
    cv,
    job,
    *,
    cv_chunks,
    cv_vectors,
    job_chunks,
    job_vectors,
    cv_document_vector,
    job_document_vector,
    model_version,
    ablation=(),
):
    """Chấm một cặp CV–tin.

    `cv`/`job` là `profile_json`; chunk là {section, text} kèm ma trận vector cùng
    thứ tự; vector tài liệu là vector toàn văn (có thể None). `ablation` chỉ dùng
    khi đo: `semantic_skills` bật lại khớp kỹ năng viết khác tên,
    `no_relevance_discount` bỏ hệ số liên quan.
    """
    unknown = set(ablation) - set(ABLATIONS)
    if unknown:
        raise ValueError(f'Ablation không hợp lệ: {sorted(unknown)}')
    if (
        not cv['skills']
        and cv['experience']['months'] is None
        and not any(chunk['section'] in EXPERIENCE_SECTIONS for chunk in cv_chunks)
    ):
        raise ScoringError('cv_insufficient_content')
    calibration = calibration_for(model_version)
    requirement_hits = _hits(
        job_chunks, job_vectors, cv_chunks, cv_vectors, section='requirement', cv_sections=EXPERIENCE_SECTIONS
    )  # fmt: skip
    skill_hits = {
        name: (similarity, sentence)
        for name, similarity, sentence in _hits(job_chunks, job_vectors, cv_chunks, cv_vectors, section='skill')
    }  # fmt: skip
    relevance, relevance_detail = _relevance(
        cv_chunks, cv_vectors, job_chunks, job_vectors, cv_document_vector, job_document_vector, calibration
    )  # fmt: skip
    data = MatchInput(
        cv,
        job,
        calibration,
        skill_hits,
        relevance,
        relevance_detail,
        semantic_skills=calibration.semantic_skills or 'semantic_skills' in ablation,
    )
    components = [rule(data) for rule in criteria.CRITERIA]

    scored = [component for component in components if component.status == 'ok']
    total_weight = sum(WEIGHTS[component.key] for component in scored)
    factor = 1.0 if 'no_relevance_discount' in ablation else _relevance_factor(relevance)
    overall = round(
        sum(
            WEIGHTS[component.key]
            * component.score
            * (factor if component.key in GENERIC_CRITERIA else 1.0)
            for component in scored
        )
        / total_weight
        if total_weight
        else 0
    )
    discounted = factor < 1.0 and any(
        component.key in GENERIC_CRITERIA and component.score for component in scored
    )
    by_key = {component.key: component for component in components}
    language_cap = bool(by_key['languages'].detail.get('missing_required'))
    if language_cap:
        overall = min(overall, LANGUAGE_REQUIRED_CAP)

    insufficient = [
        component.key for component in components if component.status == 'insufficient_data'
    ]
    estimated = cv['experience'].get('basis') == 'whole_text'
    confidence = (
        'low' if len(insufficient) >= 2 else 'medium' if insufficient or estimated else 'high'
    )
    level, label = _level(overall)
    skills_detail = by_key['skills'].detail
    return {
        'schema_version': RESULT_SCHEMA_VERSION,
        'overall': {
            'score': overall,
            'level': level,
            'label': label,
            'confidence': confidence,
            'relevance': None if relevance is None else round(relevance),
        },
        'components': [
            {
                'key': component.key,
                'score': None if component.score is None else round(component.score),
                'weight': WEIGHTS[component.key],
                'status': component.status,
                'detail': component.detail,
            }
            for component in components
        ],
        'skills': {
            'matched': skills_detail.get('matched', []),
            'missing': sorted(
                skills_detail.get('missing', []),
                key=lambda skill: skill['importance'] != 'required',
            ),
            'extra': skills_detail.get('extra', []),
        },
        'requirements': [
            {
                'text': text,
                'status': requirement_status(similarity, calibration),
                'similarity': similarity,
                # Chỉ hiện câu CV làm bằng chứng khi nó thật sự đáp ứng (một phần) yêu cầu.
                'evidence': sentence
                if requirement_status(similarity, calibration) != 'unmet'
                else '',
            }
            for text, similarity, sentence in requirement_hits
        ],
        'flags': {
            'language_mismatch': bool(
                cv['language'] and job['language'] and cv['language'] != job['language']
            ),
            'ocr_used': cv['quality'].get('ocr_used', False),
            'experience_estimated': estimated,
            'language_cap_applied': language_cap,
            'relevance_discount_applied': discounted,
            'insufficient': insufficient,
        },
    }
