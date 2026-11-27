#!/usr/bin/env bash
# Chạy trọn GĐ 3 (kế hoạch bản 3) sau khi `generate_cvs.py --train` đã xong:
#
#   bash ml/scripts/run_training.sh            # mọi bước
#   bash ml/scripts/run_training.sh train      # chỉ huấn luyện và đo (dữ liệu đã có)
#
# Thứ tự theo bộ nhớ của máy 16 GB: các bước gọi Ollama chạy trước, rồi dỡ mô hình
# Ollama và dừng các container không cần, rồi mới huấn luyện trên MPS. Nhật ký ở
# ml/data/pairs/run_training.log.
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
$PY ml/scripts/train.py --version ft-v1 2>&1 | grep -v "Loading weights" | tail -60
step "Fine-tune cross-encoder"
$PY ml/scripts/train_reranker.py 2>&1 | grep -v "Loading weights" | tail -40
step "Bật lại ml-worker và đo trên validation"
docker compose up -d ml-worker >/dev/null
for _ in $(seq 1 30); do docker compose exec -T ml-worker true 2>/dev/null && break; sleep 5; done
$PY ml/scripts/evaluate.py --ablation \
  --model e5-small-zs-v1=multilingual-e5-small/zs-v1 \
  --model minilm-l12-zs-v1=paraphrase-multilingual-MiniLM-L12-v2/zs-v1:noprefix \
  --model e5-base-ft-v1=multilingual-e5-base/ft-v1 | head -20
step "Xong"
