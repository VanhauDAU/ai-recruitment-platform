"""Baseline từ vựng: xếp hạng CV cho từng JD bằng TF-IDF và BM25 (kế hoạch mục 9, 10a).

Token là âm tiết/từ viết thường kèm bigram âm tiết (`corpus.tokenize`), nên cụm
nhiều âm tiết tiếng Việt ("kế toán", "phân tích") vẫn được khớp như một đơn vị.

Chạy: ml/.venv/bin/python ml/scripts/baseline.py
In ra kiểm tra nhanh trên nhãn yếu (CV neo vào chính JD đó): CV "strong" phải
đứng trên CV "partial", CV "partial" trên CV "adjacent". Đây chỉ là kiểm tra
hợp lý; số liệu chính đo trên tập vàng do người chấm ở tuần 5.
"""

import statistics

import numpy as np
from corpus import load_cvs, load_jds, tokenize
from paths import REPORTS_DIR
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer

WEAK_GAIN = {'strong': 3, 'partial': 2, 'adjacent': 1}


def bm25_scores(jds, cvs):
    """Ma trận điểm [số JD × số CV]."""
    index = BM25Okapi([tokenize(cv['text']) for cv in cvs])
    return np.array([index.get_scores(tokenize(jd['text'])) for jd in jds])


def tfidf_scores(jds, cvs):
    vectorizer = TfidfVectorizer(
        analyzer=tokenize, sublinear_tf=True, min_df=1, norm='l2', dtype=np.float32
    )
    matrix = vectorizer.fit_transform([cv['text'] for cv in cvs] + [jd['text'] for jd in jds])
    cv_matrix, jd_matrix = matrix[: len(cvs)], matrix[len(cvs) :]
    return (jd_matrix @ cv_matrix.T).toarray()


def ndcg_at(gains_in_rank_order, k):
    discounts = 1 / np.log2(np.arange(2, k + 2))
    actual = np.asarray(gains_in_rank_order[:k], dtype=float)
    ideal = np.sort(np.asarray(gains_in_rank_order, dtype=float))[::-1][:k]
    best = (ideal * discounts[: len(ideal)]).sum()
    return (actual * discounts[: len(actual)]).sum() / best if best else None


def weak_label_check(name, scores, jds, cvs):
    """NDCG@5 theo nhãn yếu, chỉ trên JD có ≥ 2 CV neo vào."""
    values = []
    for row, jd in enumerate(jds):
        gains = [
            WEAK_GAIN[cv['intended_match']] if cv['anchor_job'] == jd['code'] else 0 for cv in cvs
        ]
        if sum(1 for gain in gains if gain) < 2:
            continue
        order = np.argsort(-scores[row], kind='stable')
        value = ndcg_at([gains[index] for index in order], 5)
        if value is not None:
            values.append(value)
    return f'| {name} | {len(values)} | {statistics.mean(values):.3f} |'


def main():
    jds, cvs = load_jds(), load_cvs()
    lines = [
        '# Baseline từ vựng: kiểm tra trên nhãn yếu',
        '',
        f'{len(jds)} JD × {len(cvs)} CV tổng hợp. Độ lợi: CV neo vào JD với mức `strong` = 3,',
        '`partial` = 2, `adjacent` = 1, CV khác = 0. Chỉ là kiểm tra hợp lý: nhãn yếu do',
        'script sinh CV đặt ra, CV lại do LLM viết từ chính JD nên điểm bị thổi phồng.',
        'Tạo bằng `ml/scripts/baseline.py`.',
        '',
        '| Phương pháp | Số JD | NDCG@5 (nhãn yếu) |',
        '| --- | ---: | ---: |',
        weak_label_check('TF-IDF (âm tiết + bigram)', tfidf_scores(jds, cvs), jds, cvs),
        weak_label_check('BM25 (âm tiết + bigram)', bm25_scores(jds, cvs), jds, cvs),
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / 'baseline_weak_labels.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
