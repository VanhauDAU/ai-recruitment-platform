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
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt gunicorn

# ---- runtime ----
FROM base AS runtime
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
# Chỉ headless shell của Chromium (nhẹ hơn bản đầy đủ) cùng thư viện hệ thống.
RUN playwright install --with-deps --only-shell chromium \
    && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH" \
    && rm -rf /var/lib/apt/lists/*

# Chạy bằng user thường, không phải root.
RUN useradd --create-home --uid 1000 appuser
COPY --chown=appuser:appuser . .
USER appuser

EXPOSE 8000
# Dev override command trong docker-compose.yml (runserver);
# prod dùng gunicorn mặc định này.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
