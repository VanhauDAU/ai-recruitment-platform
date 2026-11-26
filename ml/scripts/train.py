"""Fine-tune bi-encoder E5 trên bộ ba huấn luyện (kế hoạch bản 3, mục 3.3), chạy trên MPS.

    PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.6 PYTORCH_MPS_LOW_WATERMARK_RATIO=0.4 \\
        ml/.venv/bin/python ml/scripts/train.py
    ml/.venv/bin/python ml/scripts/train.py --base intfloat/multilingual-e5-small --version ft-v1
    ml/.venv/bin/python ml/scripts/train.py --max-steps 4      # chạy thử vài bước

Không chạy cùng lúc với sinh dữ liệu bằng Ollama: máy 16 GB không đủ cho cả hai.

- Đầu vào `ml/data/pairs/train.jsonl` và `dev.json` (`build_train_pairs.py`).
- Loss `CachedMultipleNegativesRankingLoss`: mỗi tin phải gần CV dương hơn CV âm của
  nó và hơn mọi CV khác trong batch. Học cả hai chiều (tin → CV cho "Xem độ phù hợp",
  CV → tin cho "Việc làm gợi ý"). Sampler `NO_DUPLICATES` để một văn bản không vừa
  là dương vừa là âm trong cùng batch.
- Tiền tố E5 như lúc chạy: tin là `query: `, CV là `passage: `.
- Độ dài chuỗi 512 token như lúc chạy: văn bản CV có trung vị 409 token và 97% vượt
  256 (đo 26/11), nên huấn luyện ở 256 sẽ cắt mất gần nửa CV. Mini-batch của GradCache
  là 4 để vừa bộ nhớ MPS (8 vẫn tràn); kích thước batch (số mẫu âm trong batch) vẫn là 32. Bảng
  embedding từ được đóng băng để vừa bộ nhớ (xem chú thích trong mã).
- Theo dõi NDCG@10 trên tập dev (7 tin giữ riêng) và giữ checkpoint tốt nhất. Tập dev
  chỉ để chọn checkpoint; việc có dùng mô hình này hay không quyết định bằng
  `evaluate.py` trên validation của tập vàng.
- Kết quả: `ml/models/<tên>/<phiên bản>/` kèm `model_card.json` (mô hình gốc, hash dữ
  liệu, siêu tham số, số liệu dev, mã commit).
"""

import argparse
import hashlib
import json
import os
import subprocess
import tempfile
import time
from datetime import date

os.environ.setdefault('PYTORCH_MPS_HIGH_WATERMARK_RATIO', '0.6')
os.environ.setdefault('PYTORCH_MPS_LOW_WATERMARK_RATIO', '0.4')
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')

from paths import MODELS_DIR, PAIRS_DIR, REPO_ROOT  # noqa: E402

PREFIXES = {'anchor': 'query: ', 'positive': 'passage: ', 'negative': 'passage: '}
# torch 2.15 trên MPS không hỗ trợ dropout trong scaled_dot_product_attention (xem smoke_mps.py).
MPS_KWARGS = {'config_kwargs': {'attention_probs_dropout_prob': 0.0}}


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def load_rows(path):
    from datasets import Dataset

    rows = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]
    sources = {}
    for row in rows:
        sources[row['source']] = sources.get(row['source'], 0) + 1
    columns = {key: [row[key] for row in rows] for key in ('anchor', 'positive', 'negative')}
    return Dataset.from_dict(columns), sources


def dev_evaluator(dev):
    from sentence_transformers.sentence_transformer.evaluation import InformationRetrievalEvaluator

    return InformationRetrievalEvaluator(
        queries=dev['queries'],
        corpus=dev['corpus'],
        relevant_docs={query: set(codes) for query, codes in dev['relevant'].items()},
        query_prompt=PREFIXES['anchor'],
        corpus_prompt=PREFIXES['positive'],
        ndcg_at_k=[10],
        mrr_at_k=[10],
        accuracy_at_k=[1, 5],
        precision_recall_at_k=[5],
        map_at_k=[10],
        name='dev',
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--base', default='intfloat/multilingual-e5-base')
    parser.add_argument('--name', default=None, help='Thư mục trong ml/models (mặc định theo mô hình gốc).')
    parser.add_argument('--version', default='ft-v1')
    parser.add_argument('--epochs', type=float, default=3)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--mini-batch-size', type=int, default=4)
    parser.add_argument('--max-seq-length', type=int, default=512)
    parser.add_argument('--learning-rate', type=float, default=2e-5)
    parser.add_argument('--eval-steps', type=int, default=50)
    parser.add_argument('--max-steps', type=int, default=-1, help='Giới hạn số bước (để chạy thử).')
    parser.add_argument('--seed', type=int, default=42)
    options = parser.parse_args()

    import torch
    from sentence_transformers import (
        SentenceTransformer,
        SentenceTransformerTrainer,
        SentenceTransformerTrainingArguments,
    )
    from sentence_transformers.sentence_transformer.losses import CachedMultipleNegativesRankingLoss
    from sentence_transformers.sentence_transformer.training_args import BatchSamplers

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    train_path, dev_path = PAIRS_DIR / 'train.jsonl', PAIRS_DIR / 'dev.json'
    dataset, sources = load_rows(train_path)
    evaluator = dev_evaluator(json.loads(dev_path.read_text(encoding='utf-8')))

    model = SentenceTransformer(options.base, device=device, **MPS_KWARGS)
    model.max_seq_length = options.max_seq_length
    # Đóng băng bảng embedding từ (250 nghìn từ × 768 chiều): riêng gradient và hai bộ nhớ
    # của AdamW cho bảng này đã chiếm hơn 2 GB, làm tràn bộ nhớ MPS ở 512 token. Các lớp
    # transformer phía trên vẫn được huấn luyện; đây là cách làm quen thuộc khi fine-tune
    # mô hình đa ngữ trên máy ít bộ nhớ.
    model[0].auto_model.embeddings.word_embeddings.weight.requires_grad_(False)
    before = evaluator(model)
    loss = CachedMultipleNegativesRankingLoss(
        model,
        mini_batch_size=options.mini_batch_size,
        directions=('query_to_doc', 'doc_to_query'),
    )
    name = options.name or options.base.split('/')[-1]
    target = MODELS_DIR / name / options.version
    with tempfile.TemporaryDirectory() as checkpoints:
        args = SentenceTransformerTrainingArguments(
            output_dir=checkpoints,
            num_train_epochs=options.epochs,
            max_steps=options.max_steps,
            per_device_train_batch_size=options.batch_size,
            learning_rate=options.learning_rate,
            warmup_ratio=0.1,
            weight_decay=0.01,
            batch_sampler=BatchSamplers.NO_DUPLICATES,
            prompts=PREFIXES,
            eval_strategy='steps',
            eval_steps=options.eval_steps,
            save_strategy='steps',
            save_steps=options.eval_steps,
            save_total_limit=2,
            load_best_model_at_end=True,
            metric_for_best_model=f'eval_{evaluator.primary_metric}',
            greater_is_better=True,
            logging_steps=10,
            report_to='none',
            dataloader_pin_memory=False,
            disable_tqdm=True,
            seed=options.seed,
        )
        trainer = SentenceTransformerTrainer(
            model=model, args=args, train_dataset=dataset, loss=loss, evaluator=evaluator
        )
        started = time.perf_counter()
        trainer.train()
        minutes = (time.perf_counter() - started) / 60
    after = evaluator(model)

    target.mkdir(parents=True, exist_ok=True)
    model.save(str(target))
    history = [
        {key: round(value, 4) if isinstance(value, float) else value for key, value in entry.items()}
        for entry in trainer.state.log_history
    ]
    commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=REPO_ROOT).stdout.strip()  # fmt: skip
    short = {'multilingual-e5-base': 'e5-base', 'multilingual-e5-small': 'e5-small'}.get(name, name)
    card = {
        'model_version': f'{short}-{options.version}',
        'base_model': options.base,
        'training': 'fine-tune CachedMultipleNegativesRankingLoss (tin ↔ CV, hai chiều)',
        'data': {'train': str(train_path.relative_to(REPO_ROOT)), 'train_sha256': file_hash(train_path), 'rows': len(dataset), 'sources': sources, 'dev_sha256': file_hash(dev_path)},  # fmt: skip
        'hyperparameters': {key: getattr(options, key) for key in ('epochs', 'batch_size', 'mini_batch_size', 'max_seq_length', 'learning_rate', 'seed', 'max_steps')},  # fmt: skip
        'dev': {'metric': evaluator.primary_metric, 'before': round(before[evaluator.primary_metric], 4), 'after': round(after[evaluator.primary_metric], 4)},  # fmt: skip
        'best_checkpoint': trainer.state.best_model_checkpoint and os.path.basename(trainer.state.best_model_checkpoint),
        'frozen': ['embeddings.word_embeddings'],
        'device': device,
        'minutes': round(minutes, 1),
        'dimensions': model.get_sentence_embedding_dimension(),
        'max_seq_length': model.max_seq_length,
        'prefixes': {'job': PREFIXES['anchor'], 'cv': PREFIXES['positive']},
        'git_commit': commit,
        'exported_on': date.today().isoformat(),
    }
    (target / 'model_card.json').write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
    (target / 'train_log.json').write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(card, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
