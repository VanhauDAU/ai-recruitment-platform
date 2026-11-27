#!/usr/bin/env bash
# Dựng lại cấu hình đang dùng (`e5-base-wise-v1` + `req-ce-v1`) sau khi `generate_cvs.py --train`
# đã xong; các bước 12–16 của ml/README.md:
#
#   bash ml/scripts/run_training.sh            # mọi bước
#   bash ml/scripts/run_training.sh train      # chỉ huấn luyện và đo (dữ liệu đã có)
#
# Thứ tự theo bộ nhớ của máy 16 GB: các bước gọi Ollama chạy trước, rồi dỡ mô hình
# Ollama và dừng các container không cần, rồi mới huấn luyện trên MPS. Nhật ký ở
# ml/data/pairs/run_training.log.
#
# Không gồm: nhãn tập hiệu chỉnh và cặp yêu cầu–câu CV thật (`build_calibration_pairs.py`,
# `build_requirement_eval.py`, gán bằng tay), chép mốc vào `CALIBRATIONS`/`RERANKER_THRESHOLDS`
# (đọc báo cáo `calibration_scale_*`, `reranker_eval` rồi sửa `domain/calibration.py`), và đo gợi
# ý việc làm (cần bật mô hình mới rồi `matching_backfill`, xem bước 16 của README).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PY=ml/.venv/bin/python
STEP="${1:-all}"
step() { printf '\n==> %s (%s)\n' "$1" "$(date '+%H:%M')"; }

if [[ "$STEP" == all ]]; then
  step "Ngoại ngữ, hoạt động, giải thưởng, sở thích cho CV huấn luyện (Ollama)"
  # Hai lượt: lượt sau thử lại CV bị bỏ qua ở lượt đầu.
  $PY ml/scripts/enrich_cvs.py --train | tail -1
  $PY ml/scripts/enrich_cvs.py --train | tail -1
  step "Cổng chất lượng"
  $PY ml/scripts/quality_gate.py | head -4
  step "Sinh cặp yêu cầu – câu CV (Ollama)"
  $PY ml/scripts/build_requirement_pairs.py generate | tail -2
  step "Dỡ mô hình Ollama khỏi bộ nhớ"
  ollama stop qwen2.5:7b 2>/dev/null || true
  step "Ghép bộ ba bi-encoder và cặp cross-encoder"
  $PY ml/scripts/build_train_pairs.py | head -12
  $PY ml/scripts/build_requirement_pairs.py pairs | tail -3
fi

step "Dừng container không cần khi huấn luyện"
docker compose stop ml-worker worker ai-worker beat frontend >/dev/null 2>&1 || true
step "Fine-tune bi-encoder e5-base"
# Mini-batch 2 ở 512 token: 4 và 8 tràn bộ nhớ MPS (khoảng 90 phút).
PYTORCH_MPS_HIGH_WATERMARK_RATIO="${PYTORCH_MPS_HIGH_WATERMARK_RATIO:-0.7}" \
  $PY ml/scripts/train.py --version ft-v1 --mini-batch-size 2 2>&1 | grep -v "Loading weights" | tail -60
step "Nội suy trọng số 30% mô hình gốc + 70% ft-v1"
$PY ml/scripts/interpolate_model.py --alpha 0.7 --version wise-v1 | tail -3
step "Fine-tune cross-encoder"
$PY ml/scripts/train_reranker.py 2>&1 | grep -v "Loading weights" | tail -40
step "Bật lại ml-worker"
docker compose up -d ml-worker >/dev/null
for _ in $(seq 1 30); do docker compose exec -T ml-worker true 2>/dev/null && break; sleep 5; done
step "Hiệu chỉnh trên tập hiệu chỉnh"
$PY ml/scripts/calibrate_labeled.py --model-dir multilingual-e5-base/wise-v1 --version e5-base-wise-v1 | tail -5
$PY ml/scripts/calibrate_scale.py --model-dir multilingual-e5-base/wise-v1 --version e5-base-wise-v1 | tail -5
$PY ml/scripts/evaluate_reranker.py | tail -5
step "Đo trên validation"
# Luôn đủ cờ: thiếu cờ nào thì dòng của mô hình đó biến mất khỏi reports/eval_validation.md.
$PY ml/scripts/evaluate.py --ablation \
  --model e5-small-zs-v1=multilingual-e5-small/zs-v1 \
  --model minilm-l12-zs-v1=paraphrase-multilingual-MiniLM-L12-v2/zs-v1:noprefix \
  --hybrid-model e5-base-ft-v1=multilingual-e5-base/ft-v1 \
  --hybrid-model e5-base-wise-v1=multilingual-e5-base/wise-v1 \
  --reranker req-ce-v1=mmarco-mMiniLMv2-L12/req-ce-v1 | head -30
$PY ml/scripts/evaluate_calibration.py | tail -5
$PY ml/scripts/evaluate_public.py | tail -5
step "Xong"
