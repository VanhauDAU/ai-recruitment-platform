"""Phán từng yêu cầu của tin và từng kỹ năng còn thiếu bằng cross-encoder (`hybrid-v3`).

Hai loại câu hỏi được đem hỏi cross-encoder:

- **Câu yêu cầu loại kỹ năng, việc đã làm** (`facts.requirement_kind` trả `skill`). Bậc
  học, số năm, ngoại ngữ đã có tiêu chí riêng; phẩm chất cá nhân không đo được từ CV.
- **Kỹ năng của tin mà CV không có theo danh mục.** CV ghi "Quyết toán thuế", tin cần
  "Thuế": so tên thì thiếu, đọc câu thì đạt. Mỗi kỹ năng thiếu thành một câu hỏi ngắn
  ("Có kinh nghiệm làm việc với Thuế.").

Với mỗi câu hỏi, bi-encoder chọn `TOP_SENTENCES` câu CV gần nhất, cross-encoder chấm
từng cặp và giữ xác suất cao nhất. Tổng số cặp một lượt không quá `MAX_PAIRS`; câu yêu
cầu được chấm trước, kỹ năng thiếu sau.

Kết quả:
- trạng thái từng yêu cầu: `met` / `partial` / `unmet` theo hai ngưỡng của mô hình
  (`domain.reranker_thresholds`), kèm câu CV làm bằng chứng (luôn là câu nguyên văn);
- độ phủ yêu cầu C: trung bình xác suất × 100 trên các câu yêu cầu **không** nhắc kỹ
  năng nào của tin. Chỉ là thông tin kèm theo, không vào điểm (xem `engine.py`);
- kỹ năng thiếu được coi là có khi xác suất đạt ngưỡng `met`.
"""

from dataclasses import dataclass, field

import numpy as np

from ...domain import reranker_thresholds
from ..extraction.facts import requirement_kind
from .criteria import EXPERIENCE_SECTIONS

TOP_SENTENCES = 3
MAX_PAIRS = 90
# Kỹ năng có thể được chứng minh ở mục kỹ năng, chứng chỉ, không chỉ ở phần kể việc.
SKILL_SECTIONS = (*EXPERIENCE_SECTIONS, 'skills', 'certifications')
SKILL_QUESTION = {
    'vi': 'Có kinh nghiệm làm việc với {name}.',
    'en': 'Hands-on experience with {name}.',
}


@dataclass
class Judgements:
    requirements: list = field(default_factory=list)
    coverage: float | None = None
    # {skill_id: (xác suất, câu CV)} cho kỹ năng thiếu mà cross-encoder xác nhận là có.
    skills: dict = field(default_factory=dict)


def _status(probability, thresholds):
    met, partial = thresholds
    return 'met' if probability >= met else 'partial' if probability >= partial else 'unmet'


def _nearest(vector, cv_vectors, allowed):
    scores = cv_vectors[allowed] @ vector
    return [(allowed[index], float(scores[index])) for index in np.argsort(-scores)[:TOP_SENTENCES]]


def judge(
    job, job_chunks, job_vectors, cv_chunks, cv_vectors, *, reranker, catalog, missing_skills
):
    """Hỏi cross-encoder về các câu yêu cầu và các kỹ năng còn thiếu của một cặp CV–tin."""
    thresholds = reranker_thresholds(reranker.version)

    def sentences(sections):
        return [index for index, chunk in enumerate(cv_chunks) if chunk['section'] in sections]

    evidence, anywhere = sentences(EXPERIENCE_SECTIONS), sentences(SKILL_SECTIONS)
    questions = [
        ('requirement', chunk['text'], chunk['text'], job_vectors[index], evidence)
        for index, chunk in enumerate(job_chunks)
        if chunk['section'] == 'requirement' and requirement_kind(chunk['text']) == 'skill'
    ]
    vectors = {chunk['text']: job_vectors[index] for index, chunk in enumerate(job_chunks) if chunk['section'] == 'skill'}  # fmt: skip
    question = SKILL_QUESTION.get(job.get('language'), SKILL_QUESTION['vi'])
    questions += [
        ('skill', skill, question.format(name=skill['name']), vectors[skill['name']], anywhere)
        for skill in missing_skills
        if skill['name'] in vectors
    ]

    pairs, owners = [], []
    for number, (_, _, text, vector, allowed) in enumerate(questions):
        if not allowed or len(pairs) + TOP_SENTENCES > MAX_PAIRS:
            continue
        for index, cosine in _nearest(vector, cv_vectors, allowed):
            pairs.append((text, cv_chunks[index]['text']))
            owners.append((number, index, cosine))
    best = {}
    for (number, index, cosine), probability in zip(owners, reranker.score(pairs), strict=True):
        if number not in best or probability > best[number][0]:
            best[number] = (float(probability), index, cosine)

    found = Judgements()
    counted = {skill['skill_id'] for skill in job['skills'] if skill['counted']}
    uncovered = []
    for number, (kind, subject, _, _, _) in enumerate(questions):
        probability, index, cosine = best.get(number, (0.0, None, 0.0))
        sentence = cv_chunks[index]['text'] if index is not None else ''
        status = _status(probability, thresholds)
        if kind == 'skill':
            if status == 'met':
                found.skills[subject['skill_id']] = (round(probability, 3), sentence)
            continue
        found.requirements.append(
            {
                'text': subject,
                'kind': 'skill',
                'status': status,
                'similarity': round(cosine, 4),
                'probability': round(probability, 3),
                # Chỉ hiện câu CV làm bằng chứng khi nó thật sự đáp ứng (một phần) yêu cầu.
                'evidence': sentence if status != 'unmet' else '',
            }
        )
        named = {skill.id for skill, _ in catalog.find([subject])} if catalog is not None else set()
        if not named & counted:
            uncovered.append(probability)
    if uncovered:
        found.coverage = 100 * sum(uncovered) / len(uncovered)
    return found
