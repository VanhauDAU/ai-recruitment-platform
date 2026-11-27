"""Đo các cấu hình của công thức trên tập hiệu chỉnh: có và không có cross-encoder.

    ml/.venv/bin/python ml/scripts/evaluate_calibration.py

Chấm 321 cặp có nhãn của tập hiệu chỉnh bằng công thức đầy đủ của sản phẩm (lệnh
`matching_evaluate` trong `ml-worker`), bi-encoder `e5-base-wise-v1` với mốc đã có trong
`CALIBRATIONS`, theo bốn cấu hình:

- không có cross-encoder;
- có cross-encoder `req-ce-v1` (phán từng yêu cầu, nhận kỹ năng qua câu chứng minh);
- như trên, thêm độ phủ yêu cầu vào mức liên quan (`coverage_in_relevance`);
- như trên nhưng không dùng cross-encoder để nhận kỹ năng (`no_ce_skills`).

Một cấu hình chỉ được nhận khi không kém trên tập này và hơn trên validation của tập vàng
(`evaluate.py --reranker`). Lưu ý khi đọc số: CV của tập hiệu chỉnh do máy sinh viết với
đúng tên kỹ năng của tin, nên khớp theo tên đã gần như đủ và tập này không cho thấy được
lợi ích của việc nhận kỹ năng qua câu chứng minh; validation có những cặp CV viết khác tên.

Kết quả: `ml/reports/eval_calibration.md`.
"""

import json

import numpy as np
from calibrate_scale import product_rows
from evaluate import filled, ndcg_by_job, number, score_quality, spearman
from paths import LABELING_DIR, REPORTS_DIR

MODEL_DIR, VERSION = 'multilingual-e5-base/wise-v1', 'e5-base-wise-v1'
RERANKER = ['--reranker-path', '/models/mmarco-mMiniLMv2-L12/req-ce-v1', '--reranker-version', 'req-ce-v1']
CONFIGS = (
    ('không có cross-encoder', []),
    ('có cross-encoder `req-ce-v1`', RERANKER),
    ('cross-encoder, thêm độ phủ yêu cầu vào mức liên quan', [*RERANKER, '--ablation', 'coverage_in_relevance']),
    ('cross-encoder, không dùng để nhận kỹ năng', [*RERANKER, '--ablation', 'no_ce_skills']),
)


def main():
    labels = json.loads((LABELING_DIR / 'calibration_labels.json').read_text(encoding='utf-8'))['pairs']
    lines = [
        '# Công thức trên tập hiệu chỉnh: có và không có cross-encoder',
        '',
        f'{len(labels)} cặp có nhãn, bi-encoder `{VERSION}`. Tạo bằng `ml/scripts/evaluate_calibration.py`.',
        '',
        '| Cấu hình | Kappa | Spearman | NDCG@5 | Nhãn 0: trung vị | cao nhất | từ 50 | Điểm trung bình theo nhãn 0→4 | Tiêu chí kỹ năng: Spearman với nhãn |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
    ]
    for name, flags in CONFIGS:
        scored = [(row, out) for row, out in product_rows(labels, MODEL_DIR, VERSION, flags=flags) if 'score' in out]
        pairs = [{'jd': row['jd'], 'cv': row['cv'], 'label': row['label']} for row, _ in scored]
        gold = np.array([pair['label'] for pair in pairs])
        scores = filled([out['score'] for _, out in scored])
        quality = score_quality(pairs, scores)
        skills = filled([out['components'].get('skills') for _, out in scored])
        means = ' / '.join(number(mean, 0) for mean in quality['mean_by_label'])
        lines.append(
            f'| {name} | {number(quality["band_kappa"])} | {number(spearman(scores, gold))} | '
            f'{number(float(np.mean(list(ndcg_by_job(pairs, scores).values()))))} | {number(quality["unrelated_median"], 0)} | '
            f'{number(quality["unrelated_max"], 0)} | {quality["unrelated_at_least_50"]} | {means} | {number(spearman(skills, gold))} |'
        )
        print(lines[-1], flush=True)
    REPORTS_DIR.joinpath('eval_calibration.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
