"""Chuẩn ngoài: đo các bi-encoder trên phần test của resume-job-description-fit.

    ml/.venv/bin/python ml/scripts/evaluate_public.py

1.759 cặp CV–tin tiếng Anh, ba mức (No Fit, Potential Fit, Good Fit), do người khác xây
dựng và không liên quan tới CV tự sinh của đồ án. Dùng để kiểm tra mô hình sau fine-tune
không kém đi trên dữ liệu khác phân bố. Chỉ đo cosine toàn văn (tin `query: `, CV
`passage: `, cắt 2.000 ký tự như sản phẩm), vì dữ liệu này không có hồ sơ có cấu trúc
để chạy công thức đầy đủ.

Giới hạn phải nêu: phần train của bộ này có trong dữ liệu huấn luyện (nguồn K4). 71 tin
của phần test không có trong phần train, nhưng gần như mọi CV của phần test cũng xuất
hiện ở phần train (ghép với tin khác). Vì vậy đây là phép đo "tin chưa thấy, CV đã
thấy", không phải dữ liệu hoàn toàn lạ.

Kết quả: `ml/reports/eval_public.md`.
"""

import os

os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from paths import MODELS_DIR, PUBLIC_DIR, REPORTS_DIR  # noqa: E402
from scipy.stats import spearmanr  # noqa: E402
from sklearn.metrics import roc_auc_score  # noqa: E402

MODELS = (('e5-base-zs-v1', 'zs-v1'), ('e5-base-ft-v1', 'ft-v1'), ('e5-base-wise-v1', 'wise-v1'))
LEVELS = {'No Fit': 0, 'Potential Fit': 1, 'Good Fit': 2}
MAX_CHARS = 2000


def number(value):
    return f'{value:.3f}'.replace('.', ',')


def main():
    from sentence_transformers import SentenceTransformer

    frame = pd.read_csv(PUBLIC_DIR / 'resume_job_fit' / 'test.csv')
    train = pd.read_csv(PUBLIC_DIR / 'resume_job_fit' / 'train.csv')
    gold = frame['label'].map(LEVELS).to_numpy()
    jobs = [text[:MAX_CHARS] for text in frame['job_description_text']]
    resumes = [text[:MAX_CHARS] for text in frame['resume_text']]
    lines = [
        '# Chuẩn ngoài: resume-job-description-fit, phần test',
        '',
        f'{len(frame)} cặp tiếng Anh ({(gold == 0).sum()} No Fit, {(gold == 1).sum()} Potential Fit, {(gold == 2).sum()} Good Fit), '
        f'{frame["job_description_text"].nunique()} tin, {frame["resume_text"].nunique()} CV. Tin của phần test có trong phần train: '
        f'{len(set(frame["job_description_text"]) & set(train["job_description_text"]))}; CV của phần test có trong phần train: '
        f'{len(set(frame["resume_text"]) & set(train["resume_text"]))}. Tạo bằng `ml/scripts/evaluate_public.py`.',
        '',
        '| Mô hình | Spearman (cosine với ba mức) | AUC Good Fit so với No Fit | Cosine trung vị: No / Potential / Good |',
        '| --- | ---: | ---: | --- |',
    ]
    for version, folder in MODELS:
        path = MODELS_DIR / 'multilingual-e5-base' / folder
        if not path.exists():
            continue
        model = SentenceTransformer(str(path), device='mps')
        model.max_seq_length = 512

        def encode(texts, prefix, model=model):
            unique = sorted(set(texts))
            vectors = model.encode([prefix + text for text in unique], batch_size=8, normalize_embeddings=True)
            return dict(zip(unique, vectors, strict=True))

        job_vectors, resume_vectors = encode(jobs, 'query: '), encode(resumes, 'passage: ')
        cosine = np.array([float(job_vectors[job] @ resume_vectors[resume]) for job, resume in zip(jobs, resumes, strict=True)])
        extreme = gold != 1
        medians = ' / '.join(number(float(np.median(cosine[gold == level]))) for level in range(3))
        lines.append(
            f'| `{version}` | {number(float(spearmanr(cosine, gold).statistic))} | '
            f'{number(float(roc_auc_score(gold[extreme] == 2, cosine[extreme])))} | {medians} |'
        )
        del model
    REPORTS_DIR.joinpath('eval_public.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
