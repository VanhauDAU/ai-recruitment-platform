"""Kiểm tra máy này mã hóa và fine-tune được mô hình embedding trên Apple MPS.

Chạy từ thư mục gốc của repo:

    ml/.venv/bin/python ml/scripts/smoke_mps.py
    ml/.venv/bin/python ml/scripts/smoke_mps.py --steps 30 --batch-size 16

In ra tốc độ mã hóa, thời gian mỗi bước huấn luyện và bộ nhớ MPS. Dữ liệu là văn
bản tổng hợp nên số liệu chỉ để ước lượng thời gian, không nói gì về chất lượng.

Trên máy 16 GB nên giới hạn vùng nhớ MPS, nếu không nó phình tới khoảng 9,7 GB và
đẩy máy vào swap (đo với giới hạn 0.6: khoảng 7,4 GB, chậm hơn khoảng 9%):

    PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.6 PYTORCH_MPS_LOW_WATERMARK_RATIO=0.4 \
        ml/.venv/bin/python ml/scripts/smoke_mps.py
"""

import argparse
import random
import tempfile
import time

import torch
from datasets import Dataset
from sentence_transformers import (
    SentenceTransformer,
    SentenceTransformerTrainer,
    SentenceTransformerTrainingArguments,
)
from sentence_transformers.sentence_transformer.losses import CachedMultipleNegativesRankingLoss
from sentence_transformers.sentence_transformer.training_args import BatchSamplers

MODEL_NAME = 'intfloat/multilingual-e5-base'
# torch 2.15 trên MPS không hỗ trợ dropout trong scaled_dot_product_attention, nên
# huấn luyện với cấu hình mặc định báo NotImplementedError. Tắt attention dropout
# là cách nhanh nhất đã đo; PYTORCH_ENABLE_MPS_FALLBACK không chữa được lỗi này.
MPS_TRAINING_KWARGS = {'config_kwargs': {'attention_probs_dropout_prob': 0.0}}
SKILLS = [
    'Python', 'Django', 'PostgreSQL', 'Docker', 'Redis', 'React', 'Java', 'Spring Boot',
    'Kubernetes', 'AWS', 'SQL', 'Excel', 'Figma', 'SEO', 'Kế toán tổng hợp', 'Chăm sóc khách hàng',
]  # fmt: skip


def job_text(index, rng):
    first, second, third, fourth = rng.sample(SKILLS, 4)
    return (
        f'query: Tuyển dụng vị trí số {index}. Yêu cầu ít nhất hai năm kinh nghiệm với {first} '
        f'và {second}, hiểu biết về {third}, ưu tiên từng dùng {fourth}. Mô tả công việc: phân '
        'tích yêu cầu, thiết kế giải pháp, phát triển tính năng mới, viết kiểm thử tự động và '
        'vận hành hệ thống ổn định. We also expect good communication skills, ownership of '
        'delivered features and the ability to work in an agile team with code review culture.'
    )


def cv_text(index, rng):
    first, second, third, fourth = rng.sample(SKILLS, 4)
    return (
        f'passage: Hồ sơ số {index}. Ba năm kinh nghiệm phát triển sản phẩm với {first}, {second}. '
        'Đã xây dựng và triển khai hệ thống quản lý đơn hàng phục vụ hàng chục nghìn người dùng, '
        'tối ưu truy vấn cơ sở dữ liệu giảm 40% thời gian phản hồi, thiết lập quy trình CI/CD. '
        f'Kỹ năng khác: {third}, {fourth}. Tốt nghiệp đại học ngành công nghệ thông tin, có chứng '
        'chỉ tiếng Anh, từng dẫn dắt nhóm ba người trong dự án thương mại điện tử.'
    )


def synthetic_triplets(count, seed=42):
    rng = random.Random(seed)
    return Dataset.from_dict(
        {
            'anchor': [job_text(index, rng) for index in range(count)],
            'positive': [cv_text(index, rng) for index in range(count)],
            'negative': [cv_text(index + count, rng) for index in range(count)],
        }
    )


def encode_rate(model, texts):
    model.encode(texts[:8], batch_size=8)  # làm nóng trước khi bấm giờ
    started = time.perf_counter()
    model.encode(texts, batch_size=32)
    return len(texts) / (time.perf_counter() - started)


def train_seconds_per_step(model, dataset, *, steps, batch_size, mini_batch_size):
    loss = CachedMultipleNegativesRankingLoss(model, mini_batch_size=mini_batch_size)
    with tempfile.TemporaryDirectory() as output_dir:
        args = SentenceTransformerTrainingArguments(
            output_dir=output_dir,
            max_steps=steps,
            per_device_train_batch_size=batch_size,
            learning_rate=2e-5,
            batch_sampler=BatchSamplers.NO_DUPLICATES,
            save_strategy='no',
            report_to='none',
            logging_steps=max(1, steps // 3),
            dataloader_pin_memory=False,
            disable_tqdm=True,
            seed=42,
        )
        trainer = SentenceTransformerTrainer(
            model=model, args=args, train_dataset=dataset, loss=loss
        )
        started = time.perf_counter()
        trainer.train()
        elapsed = time.perf_counter() - started
    losses = [round(entry['loss'], 3) for entry in trainer.state.log_history if 'loss' in entry]
    return elapsed / steps, losses


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model', default=MODEL_NAME)
    parser.add_argument('--steps', type=int, default=15)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--mini-batch-size', type=int, default=16)
    parser.add_argument('--max-seq-length', type=int, default=256)
    options = parser.parse_args()

    if not torch.backends.mps.is_available():
        raise SystemExit('MPS không khả dụng trên máy này.')

    model = SentenceTransformer(options.model, device='mps', **MPS_TRAINING_KWARGS)
    model.max_seq_length = options.max_seq_length
    dataset = synthetic_triplets(options.steps * options.batch_size)

    rate = encode_rate(model, dataset['anchor'][:100])
    print(f'Mã hóa: {rate:.0f} câu/giây')

    per_step, losses = train_seconds_per_step(
        model,
        dataset,
        steps=options.steps,
        batch_size=options.batch_size,
        mini_batch_size=options.mini_batch_size,
    )
    print(f'Huấn luyện: {per_step:.2f} giây/bước (batch {options.batch_size}), loss {losses}')
    print(
        'Bộ nhớ MPS: tensor đang dùng '
        f'{torch.mps.current_allocated_memory() / 1e9:.1f} GB, '
        f'driver đã cấp {torch.mps.driver_allocated_memory() / 1e9:.1f} GB'
    )


if __name__ == '__main__':
    main()
