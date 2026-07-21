# Backend Django + Celery. WeasyPrint cần system libs (pango/cairo/gdk-pixbuf)
# ở CẢ runtime — không chỉ lúc build.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps cho WeasyPrint (render PDF) + fonts tiếng Việt + healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 \
      libpangoft2-1.0-0 \
      libcairo2 \
      libgdk-pixbuf-2.0-0 \
      libffi8 \
      shared-mime-info \
      fonts-dejavu-core \
      fonts-noto-core \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- deps layer (cache theo requirements) ----
FROM base AS deps
COPY requirements.txt ./
RUN pip install -r requirements.txt gunicorn

# ---- runtime ----
FROM base AS runtime
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Chạy bằng user thường, không phải root.
RUN useradd --create-home --uid 1000 appuser
COPY --chown=appuser:appuser . .
USER appuser

EXPOSE 8000
# Dev override command trong docker-compose.yml (runserver);
# prod dùng gunicorn mặc định này.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
