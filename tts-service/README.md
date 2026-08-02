# ProCV VieNeu-TTS service

Dịch vụ private chạy VieNeu-TTS v3 Turbo. Đường live dùng ONNX/CPU và chia bài
viết thành segment ngữ nghĩa 180–240 ký tự; mỗi segment nhường scheduler để
người đọc khác không phải chờ hết một bài dài. Mỗi artifact có đúng một live
generation: mọi request cùng identity cùng tail một file PCM đang tăng dần.
Khi inference kết thúc, service đóng WAV rồi encode MP3 96 kbps từ chính WAV
đó trong thread nền; không có endpoint hoặc lượt inference thứ hai.

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
