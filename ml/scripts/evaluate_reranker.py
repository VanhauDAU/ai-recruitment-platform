"""Đo cross-encoder phán từng yêu cầu trên cặp thật có nhãn, chọn hai ngưỡng.

    ml/.venv/bin/python ml/scripts/evaluate_reranker.py

Đầu vào: `ml/labeling/requirement_labels.json` (`build_requirement_eval.py merge`), mỗi
cặp là một câu yêu cầu thật của tin và một câu CV do bi-encoder chọn, nhãn `met` /
`partial` / `unmet`.

So bốn cách chấm một cặp:
- cross-encoder đã huấn luyện `req-ce-v1`;
- cross-encoder gốc chưa huấn luyện (`mmarco-mMiniLMv2-L12-H384-v1`);
- cosine của bi-encoder gốc và của bi-encoder đang chọn (cách sản phẩm đang làm).

Chỉ số: AUC tách `met` khỏi `unmet`, AUC tách `met` khỏi phần còn lại, average precision
của `met`.

Ngưỡng chỉ chọn trên phần `calibration`:
- `met`: ngưỡng thấp nhất mà precision của "đạt" còn từ 0,85 (mục tiêu của kế hoạch);
  không có ngưỡng nào đạt thì lấy ngưỡng cho F1 cao nhất;
- `partial`: ngưỡng cho F1 cao nhất khi tách "có liên quan trở lên" khỏi "không đạt".
Phần `validation` chỉ dùng để báo cáo precision, recall và bảng nhầm lẫn với hai ngưỡng đó.

Kết quả: `ml/reports/reranker_eval.md`.
"""

import json
import os

os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')

import numpy as np  # noqa: E402
from paths import LABELING_DIR, MODELS_DIR, REPORTS_DIR  # noqa: E402
from sklearn.metrics import average_precision_score, precision_recall_curve, roc_auc_score  # noqa: E402

RERANKER = MODELS_DIR / 'mmarco-mMiniLMv2-L12' / 'req-ce-v1'
BASE_RERANKER = 'cross-encoder/mmarco-mMiniLMv2-L12-H384-v1'
ENCODERS = (('bi-encoder `e5-base-zs-v1` (cosine)', 'zs-v1'), ('bi-encoder `e5-base-wise-v1` (cosine)', 'wise-v1'))
MAX_LENGTH = 160
PRECISION_TARGET = 0.85
LEVELS = ('unmet', 'partial', 'met')


def number(value):
    return '–' if value is None or np.isnan(value) else f'{value:.3f}'.replace('.', ',')


def reranker_scores(path, rows):
    import torch
    from sentence_transformers.cross_encoder import CrossEncoder

    model = CrossEncoder(str(path), num_labels=1, max_length=MAX_LENGTH, device='mps', activation_fn=torch.nn.Sigmoid())
    return np.asarray(model.predict([(row['requirement'], row['sentence']) for row in rows], batch_size=32), dtype=float)


def encoder_scores(folder, rows):
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(str(MODELS_DIR / 'multilingual-e5-base' / folder), device='mps')
    left = model.encode(['query: ' + row['requirement'] for row in rows], batch_size=32, normalize_embeddings=True)
    right = model.encode(['passage: ' + row['sentence'] for row in rows], batch_size=32, normalize_embeddings=True)
    return np.sum(left * right, axis=1).astype(float)


def quality(scores, labels):
    met, unmet = labels == 'met', labels == 'unmet'
    extreme = met | unmet
    return (
        roc_auc_score(met[extreme], scores[extreme]) if met.any() and unmet.any() else float('nan'),
        roc_auc_score(met, scores) if met.any() and not met.all() else float('nan'),
        average_precision_score(met, scores) if met.any() else float('nan'),
    )


def thresholds(scores, labels):
    """(ngưỡng đạt, ngưỡng có liên quan, ghi chú) chọn trên phần calibration."""
    met = labels == 'met'
    precision, recall, cuts = precision_recall_curve(met, scores)
    reaching = [index for index in range(len(cuts)) if precision[index] >= PRECISION_TARGET and recall[index] > 0]
    if reaching:
        best, note = reaching[0], f'ngưỡng thấp nhất có precision từ {PRECISION_TARGET:.2f}'.replace('.', ',')
    else:
        f1 = 2 * precision[:-1] * recall[:-1] / np.maximum(precision[:-1] + recall[:-1], 1e-9)
        best, note = int(np.argmax(f1)), 'không ngưỡng nào đạt precision 0,85; lấy ngưỡng cho F1 cao nhất'
    related = labels != 'unmet'
    precision2, recall2, cuts2 = precision_recall_curve(related, scores)
    f1 = 2 * precision2[:-1] * recall2[:-1] / np.maximum(precision2[:-1] + recall2[:-1], 1e-9)
    partial = float(cuts2[int(np.argmax(f1))])
    return float(cuts[best]), min(partial, float(cuts[best])), note


def main():
    rows = json.loads((LABELING_DIR / 'requirement_labels.json').read_text(encoding='utf-8'))['pairs']
    labels = np.array([row['label'] for row in rows])
    part = np.array([row['part'] for row in rows])
    systems = {'cross-encoder `req-ce-v1`': reranker_scores(RERANKER, rows), 'cross-encoder gốc (chưa huấn luyện)': reranker_scores(BASE_RERANKER, rows)}
    systems.update({name: encoder_scores(folder, rows) for name, folder in ENCODERS})

    lines = [
        '# Cross-encoder trên cặp yêu cầu – câu CV thật',
        '',
        f'{len(rows)} cặp có nhãn (`ml/reports/requirement_labels.md`): phần calibration {int((part == "calibration").sum())} cặp để chọn ngưỡng,',
        f'phần validation {int((part == "validation").sum())} cặp để báo cáo. Tạo bằng `ml/scripts/evaluate_reranker.py`.',
    ]
    for name in ('calibration', 'validation'):
        chosen = part == name
        lines += ['', f'## Phần {name}', '', '| Cách chấm | AUC đạt so với không đạt | AUC đạt so với còn lại | Average precision của "đạt" |', '| --- | ---: | ---: | ---: |']
        for system, scores in systems.items():
            lines.append(f'| {system} | ' + ' | '.join(number(value) for value in quality(scores[chosen], labels[chosen])) + ' |')

    scores = systems['cross-encoder `req-ce-v1`']
    calibration, validation = part == 'calibration', part == 'validation'
    met_cut, partial_cut, note = thresholds(scores[calibration], labels[calibration])
    lines += ['', '## Ngưỡng của `req-ce-v1`', '', f'Chọn trên phần calibration: "đạt" từ {number(met_cut)} ({note}); "có liên quan" từ {number(partial_cut)}.', '']
    lines += ['| Phần | Precision của "đạt" | Recall của "đạt" | Số cặp được phán "đạt" |', '| --- | ---: | ---: | ---: |']
    for name, chosen in (('calibration', calibration), ('validation', validation)):
        predicted = scores[chosen] >= met_cut
        truth = labels[chosen] == 'met'
        precision = float((predicted & truth).sum() / predicted.sum()) if predicted.any() else float('nan')
        recall = float((predicted & truth).sum() / truth.sum()) if truth.any() else float('nan')
        lines.append(f'| {name} | {number(precision)} | {number(recall)} | {int(predicted.sum())} |')
    predicted = np.where(scores >= met_cut, 'met', np.where(scores >= partial_cut, 'partial', 'unmet'))
    lines += ['', 'Bảng nhầm lẫn trên phần validation (hàng: nhãn, cột: mô hình phán):', '', '| | không đạt | có liên quan | đạt |', '| --- | ---: | ---: | ---: |']
    for truth in LEVELS:
        counts = [int(((labels == truth) & (predicted == guess) & validation).sum()) for guess in LEVELS]
        lines.append(f'| {truth} | ' + ' | '.join(map(str, counts)) + ' |')
    REPORTS_DIR.joinpath('reranker_eval.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
