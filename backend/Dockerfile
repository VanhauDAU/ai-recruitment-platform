# syntax=docker/dockerfile:1.7

# Backend Django + Celery. Worker xuất PDF CV bằng Chromium headless (Playwright)
# in trang `cv-print.html` của frontend — xem apps/cvs/services/pdf_renderer.py.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

# Font dự phòng cho ký tự ngoài bộ font CV + LibreOffice (đọc DOCX khi import)
# + healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libffi8 \
      fonts-dejavu-core \
      fonts-noto-core \
      libreoffice-writer \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- deps layer (cache theo requirements) ----
FROM base AS deps
# Công cụ dev/test (ruff, import-linter, pytest) chỉ cài khi build cho compose dev:
# docker compose truyền INSTALL_DEV=true; image production giữ mặc định false.
ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; \
    else pip install -r requirements.txt; fi

# ---- ml-worker: đối sánh CV–JD (torch CPU + sentence-transformers) ----
# Đặt trước `runtime` để `runtime` vẫn là stage mặc định: image web không có torch.
# Không cần Chromium/Playwright (chỉ worker xuất PDF dùng).
FROM deps AS ml-deps
COPY requirements-ml.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements-ml.txt

FROM base AS ml
ENV DJANGO_SETTINGS_MODULE=config.settings.production
COPY --from=ml-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ml-deps /usr/local/bin /usr/local/bin
RUN useradd --create-home --uid 1000 appuser
COPY --chown=appuser:appuser . .
USER appuser
CMD ["celery", "-A", "config", "worker", "--loglevel=info", "-Q", "ai-matching", "--concurrency=1"]

# ---- runtime ----
FROM base AS runtime
# Image mặc định là production; compose dev ghi đè bằng config.settings.development.
ENV DJANGO_SETTINGS_MODULE=config.settings.production
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
# Chỉ headless shell của Chromium (nhẹ hơn bản đầy đủ) cùng thư viện hệ thống.
RUN playwright install --with-deps --only-shell chromium \
    && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH" \
    && rm -rf /var/lib/apt/lists/*

# Chạy bằng user thường, không phải root. /app/var/celerybeat có sẵn với chủ
# appuser để volume lịch beat (compose prod) nhận đúng quyền khi mount lần đầu.
RUN useradd --create-home --uid 1000 appuser \
    && install -d -o appuser -g appuser /app/var /app/var/celerybeat
COPY --chown=appuser:appuser . .
USER appuser

EXPOSE 8000
# Dev override command trong docker-compose.yml (runserver);
# prod dùng gunicorn mặc định này.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
