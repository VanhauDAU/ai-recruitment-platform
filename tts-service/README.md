# ProCV VieNeu-TTS service

Dịch vụ private chạy VieNeu-TTS v3 Turbo. Đường live dùng ONNX/CPU và chia bài
viết thành segment ngữ nghĩa 180–240 ký tự; mỗi segment nhường scheduler để
người đọc khác không phải chờ hết một bài dài. Mỗi artifact có đúng một live
generation: mọi request cùng identity cùng tail một file PCM đang tăng dần.
Policy `durable` của blog đóng WAV rồi encode MP3 96 kbps từ chính WAV trong
thread nền. Policy `cache_only` của chatbot/onboarding dừng ở cache WAV/PCM,
không tạo MP3/metadata/finalizer không được sử dụng.

Artifact key là SHA-256 của text hash, source revision, voice, style và config
fingerprint (model source/revision, backend, precision, sample rate, phiên bản
normalizer/segmentation/PCM/MP3/watermark). Backend giữ trạng thái
`GENERATING/READY/FAILED`, unique constraint và row lock gom các request cùng
identity. Celery finalizer dùng DB lease có thời hạn để retry/reconciliation
không sao chép trùng; nó chỉ chờ `READY` rồi sao chép MP3 hoàn chỉnh qua public
media storage (R2 ở production, local media ở dev). Endpoint
`GET /internal/v1/artifacts/<sha256>` chỉ báo trạng thái và metadata.
Artifact của revision cũ và bản `FAILED` được dọn sau thời gian grace cấu hình
bởi `SPEECH_ARTIFACT_RETENTION_DAYS` (mặc định 30 ngày).

## Chạy bằng Docker Compose

Tại root repository:

```bash
docker compose up --build tts backend frontend
```

Lần đầu service tải model vào volume `tts_huggingface_cache`. Các lần sau dùng
cache local. Kiểm tra readiness:

```bash
curl http://127.0.0.1:8001/readyz
```

## Chạy native trên macOS Apple Silicon

ONNX native nhanh hơn chạy image `linux/amd64` qua giả lập:

```bash
cd tts-service
cp .env.example .env
uv sync --extra dev
set -a
source .env
set +a
uv run uvicorn procv_tts.main:app --host 127.0.0.1 --port 8001 --workers 1
```

Chạy backend/frontend native với `SPEECH_TTS_BASE_URL=http://127.0.0.1:8001`
và Vite mặc định proxy `/tts` về cổng này.

## Chạy offline

Sau khi model đã nằm trong Hugging Face cache, đặt `HF_HUB_OFFLINE=1`. Ở
production nên tải một snapshot theo commit SHA vào volume/image, đặt
`TTS_MODEL_SOURCE` về đường dẫn snapshot và dùng cùng SHA cho
`TTS_MODEL_REVISION` để cache audio tự invalidation khi nâng model.

Không tăng `--workers`: mỗi worker sẽ nhân bản model và lock singleflight trong
RAM không còn dùng chung. `TTS_MAX_ACTIVE_SESSIONS`
giới hạn lượng text ngắn hạn giữ trong RAM. Muốn tăng throughput, scale thành
nhiều container theo consistent-hash của artifact key, hoặc bổ sung distributed
generation registry/session store trước khi bật round-robin.

## Runtime chuẩn

- CPU mặc định: `TTS_BACKEND=onnx`, `TTS_PRECISION=int8`.
  `TTS_MAX_CONCURRENT_STREAMS` là đúng số model worker; bắt đầu bằng `1`,
  benchmark rồi mới tăng.
- GPU: cài `.[gpu]`, dùng `TTS_BACKEND=pytorch`, `TTS_PRECISION=fp32`. Contract
  artifact và singleflight giữ nguyên; không dựng pipeline batch riêng tạo lại
  audio đã phát.
- Container cần `ffmpeg` để mã hoá MP3 mono 96 kbps. `/readyz` báo backend,
  native streaming, model worker, ONNX threads và tình trạng ffmpeg.

## Guardrail và biến môi trường

`SPEECH_RUNTIME_ENABLED` là hard switch, đứng trên mọi Site Setting. Giá trị
mặc định là `true` ở development và `false` ở production. Khi tắt, service
không nạp model; `/healthz` vẫn trả liveness, `/readyz` trả `503`, còn
`GET /internal/v1/status` trả `status=disabled`. Backend tiếp tục phục vụ nội
dung văn bản và không cho admin setting vượt qua hard switch.

Baseline production là đúng một process/worker model:

| Biến | Giá trị ban đầu | Vai trò |
| --- | ---: | --- |
| `TTS_MAX_ACTIVE_GENERATIONS` | `3` | Tối đa ba artifact mới đang sinh; artifact thứ tư nhận `503` + `Retry-After: 2`. |
| `TTS_MAX_CONCURRENT_STREAMS` | `1` | Một model worker; request cùng artifact dùng singleflight. |
| `TTS_ONNX_THREADS` | `2` | Thread ONNX/OMP; chỉ thử `3` sau benchmark không đạt. |
| `TTS_CACHE_MAX_GB` | `5` | Trần tổng cache local. |
| `TTS_PCM_CACHE_TTL_SECONDS` | `86400` | PCM giữ 24 giờ. |
| `TTS_WAV_CACHE_TTL_SECONDS` | `259200` | WAV hoàn chỉnh giữ 72 giờ. |
| `TTS_ARTIFACT_CACHE_TTL_SECONDS` | `259200` | MP3 và metadata local giữ 72 giờ. |

Prune được schedule ở thread nền sau atomic commit, không chạy trên critical
inference path. Thống kê filesystem trong status được cache 60 giây. Status
nội bộ bắt buộc header `X-TTS-Internal-Token` và không trả raw text/user ID:

```bash
curl -H "X-TTS-Internal-Token: $TTS_INTERNAL_TOKEN" \
  http://127.0.0.1:8001/internal/v1/status
```

## Benchmark rollout

Chạy trên đúng máy production dự kiến (4 vCPU, 8 GB RAM), sau warm-up, với
backend health endpoint cùng host. Script in duy nhất JSON ra stdout; không ghi
report vào repository:

```bash
TTS_INTERNAL_TOKEN='<token>' python scripts/benchmark.py \
  --base-url http://127.0.0.1:8001 \
  --web-url http://127.0.0.1:8000/api/health/ \
  --runs 10 --web-runs 50
```

JSON gồm cache miss/hit, ba artifact khác nhau chạy đồng thời, mười request
cùng artifact (singleflight), TTFA/RTF p95 theo scenario, queue wait, CPU, RAM,
cache hit/miss, rejection và Web API p95 trước/dưới tải. Gate bật production:

- cached first-audio p95 ≤ 300 ms; cache-miss first-audio p95 ≤ 1,5 giây;
- RTF p95 ≤ 0,7; queue wait p95 ≤ 2 giây; rejection < 1%;
- RSS TTS < 1,8 GB; Web API p95 suy giảm không quá 20%.

Nếu chưa đạt, benchmark lại theo đúng thứ tự: threads `2 → 3`, rồi CPU limit
`2.5 → 3.5`. Không tăng worker/replica. Giữ sample rate 48 kHz; chỉ mở đánh giá
24 kHz nếu outbound vượt 30% quota hoặc bandwidth vượt 10% tổng chi phí.

Ví dụ cấu trúc kết quả (số liệu chỉ minh hoạ, không phải kết quả nghiệm thu):

```json
{
  "summary": {
    "by_scenario": {"cache_hit": {"ttfa_ms_p95": 210.0}},
    "queue_wait_ms_p95": 420.0,
    "process_rss_bytes_peak": 1450000000,
    "rejection_rate": 0.0,
    "web_api": {"degradation_ratio": 0.08}
  }
}
```

Benchmark thật không chạy trong CI vì phụ thuộc model và phần cứng. Không bật
`SPEECH_RUNTIME_ENABLED=true` ở production chỉ dựa trên số minh hoạ này.
