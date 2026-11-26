"""Fine-tune cross-encoder phán câu CV có đáp ứng một yêu cầu của tin (kế hoạch bản 3, mục 3.4).

    ml/.venv/bin/python ml/scripts/train_reranker.py
    ml/.venv/bin/python ml/scripts/train_reranker.py --max-steps 4     # chạy thử

Không chạy cùng lúc với sinh dữ liệu bằng Ollama (máy 16 GB).

- Mô hình gốc `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` (118 triệu tham số,
  Apache-2.0, đa ngữ có tiếng Việt). Đầu ra một số; `Sigmoid` biến thành xác suất.
- Đầu vào `ml/data/pairs/reranker_train.jsonl`, `reranker_dev.jsonl`
  (`build_requirement_pairs.py pairs`): cặp (câu yêu cầu, câu CV) nhãn 1 / 0,5 / 0.
- Loss `BinaryCrossEntropyLoss` (nhận nhãn thực trong [0, 1], nên mức 0,5 "liên
  quan, chưa đủ" dùng được). Theo dõi average precision trên dev (chỉ cặp nhãn 0 và
  1), giữ checkpoint tốt nhất. Ngưỡng "đạt"/"chưa rõ" của sản phẩm KHÔNG lấy từ dev
  này mà chọn trên cặp yêu cầu–câu CV thật của các tin validation (GĐ 5).
- Kết quả: `ml/models/mmarco-mMiniLMv2-L12/req-ce-v1/` kèm `model_card.json`.
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

BASE = 'cross-encoder/mmarco-mMiniLMv2-L12-H384-v1'
# Câu yêu cầu và câu CV đều ngắn; 160 token đủ cho cả cặp và giữ độ trễ thấp lúc chạy.
MAX_LENGTH = 160
MPS_KWARGS = {'config_kwargs': {'attention_probs_dropout_prob': 0.0}}


def rows(name):
    return [json.loads(line) for line in (PAIRS_DIR / name).read_text(encoding='utf-8').splitlines()]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--base', default=BASE)
    parser.add_argument('--version', default='req-ce-v1')
    parser.add_argument('--epochs', type=float, default=3)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--learning-rate', type=float, default=2e-5)
    parser.add_argument('--eval-steps', type=int, default=50)
    parser.add_argument('--max-steps', type=int, default=-1)
    parser.add_argument('--seed', type=int, default=42)
    options = parser.parse_args()

    import torch
    from datasets import Dataset
    from sentence_transformers.cross_encoder import CrossEncoder, CrossEncoderTrainer, CrossEncoderTrainingArguments
    from sentence_transformers.cross_encoder.evaluation import CrossEncoderClassificationEvaluator
    from sentence_transformers.cross_encoder.losses import BinaryCrossEntropyLoss

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    train, dev = rows('reranker_train.jsonl'), rows('reranker_dev.jsonl')
    dataset = Dataset.from_dict({
        'requirement': [row['requirement'] for row in train],
        'sentence': [row['sentence'] for row in train],
        'label': [float(row['label']) for row in train],
    })  # fmt: skip
    binary = [row for row in dev if row['label'] in (0.0, 1.0)]
    evaluator = CrossEncoderClassificationEvaluator(
        sentence_pairs=[(row['requirement'], row['sentence']) for row in binary],
        labels=[int(row['label']) for row in binary],
        name='dev',
    )
    model = CrossEncoder(
        options.base, num_labels=1, max_length=MAX_LENGTH, device=device,
        activation_fn=torch.nn.Sigmoid(), **MPS_KWARGS,
    )  # fmt: skip
    before = evaluator(model)
    loss = BinaryCrossEntropyLoss(model)
    with tempfile.TemporaryDirectory() as checkpoints:
        args = CrossEncoderTrainingArguments(
            output_dir=checkpoints,
            num_train_epochs=options.epochs,
            max_steps=options.max_steps,
            per_device_train_batch_size=options.batch_size,
            learning_rate=options.learning_rate,
            warmup_ratio=0.1,
            weight_decay=0.01,
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
        trainer = CrossEncoderTrainer(model=model, args=args, train_dataset=dataset, loss=loss, evaluator=evaluator)
        started = time.perf_counter()
        trainer.train()
        minutes = (time.perf_counter() - started) / 60
    after = evaluator(model)

    target = MODELS_DIR / options.base.split('/')[-1].replace('-H384-v1', '') / options.version
    target.mkdir(parents=True, exist_ok=True)
    model.save(str(target))
    digest = hashlib.sha256((PAIRS_DIR / 'reranker_train.jsonl').read_bytes()).hexdigest()[:16]
    commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=REPO_ROOT).stdout.strip()  # fmt: skip
    card = {
        'model_version': options.version,
        'base_model': options.base,
        'training': 'fine-tune BinaryCrossEntropyLoss trên cặp (câu yêu cầu, câu CV), nhãn 1 / 0,5 / 0',
        'data': {'train_rows': len(train), 'dev_rows': len(dev), 'train_sha256': digest},
        'hyperparameters': {key: getattr(options, key) for key in ('epochs', 'batch_size', 'learning_rate', 'seed', 'max_steps')} | {'max_length': MAX_LENGTH},  # fmt: skip
        'dev': {
            'metric': evaluator.primary_metric,
            'before': round(before[evaluator.primary_metric], 4),
            'after': round(after[evaluator.primary_metric], 4),
            'all_after': {key: round(value, 4) for key, value in after.items()},
        },
        'device': device,
        'minutes': round(minutes, 1),
        'output': 'xác suất câu CV đáp ứng yêu cầu (Sigmoid)',
        'git_commit': commit,
        'exported_on': date.today().isoformat(),
    }
    (target / 'model_card.json').write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(card, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
