# syntax=docker/dockerfile:1.7

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/var/cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libgomp1 \
      libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependency AI nặng được cache chỉ theo pyproject. Thay đổi source sau đó chỉ
# tạo lại wheel nhỏ của service, không tải/cài lại vieneu + ONNX.
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/pip \
    python -c 'import subprocess, sys, tomllib; dependencies = tomllib.load(open("pyproject.toml", "rb"))["project"]["dependencies"]; subprocess.check_call([sys.executable, "-m", "pip", "install", *dependencies])'

COPY src ./src
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-deps .

RUN useradd --create-home --uid 10001 ttsuser \
    && mkdir -p /var/cache/huggingface /var/cache/procv-tts \
    && chown -R ttsuser:ttsuser /var/cache/huggingface /var/cache/procv-tts

USER ttsuser
EXPOSE 8001

# Một worker để model chỉ được nạp một lần. Concurrency inference được giới hạn
# bằng segment scheduler trong ứng dụng, không nhân bản process/model.
CMD ["uvicorn", "procv_tts.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
