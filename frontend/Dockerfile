# syntax=docker/dockerfile:1.7

# Image `web` production: build SPA bằng Vite rồi phục vụ bằng Nginx. Nginx vừa là
# cổng công khai (route SEO/API về Django, còn lại là SPA) vừa phục vụ dist thuần
# ở cổng nội bộ 8080 cho Django lấy SEO shell và Chromium in CV.
# Dev không dùng file này: docker-compose.yml chạy Vite dev server.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Mọi VITE_* bị nhúng vào JavaScript công khai lúc build: chỉ giá trị public.
ARG VITE_API_BASE_URL=/api
ARG VITE_RECAPTCHA_SITE_KEY=
ARG VITE_PUBLIC_ASSET_BASE_URL=
ARG VITE_SITE_LOGO_URL=
ARG VITE_SITE_LOGO_MARK_URL=
ARG VITE_SITE_FAVICON_URL=
ARG VITE_COOKIE_CONSENT_ENABLED=true
ARG VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_PUBLIC_ASSET_BASE_URL=$VITE_PUBLIC_ASSET_BASE_URL \
    VITE_SITE_LOGO_URL=$VITE_SITE_LOGO_URL \
    VITE_SITE_LOGO_MARK_URL=$VITE_SITE_LOGO_MARK_URL \
    VITE_SITE_FAVICON_URL=$VITE_SITE_FAVICON_URL \
    VITE_COOKIE_CONSENT_ENABLED=$VITE_COOKIE_CONSENT_ENABLED \
    VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=$VITE_ANNOUNCEMENT_ROLLOUT_SURFACES \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT

COPY . .
RUN npm run build && rm -rf dist/.vite && node scripts/precompress-dist.mjs

FROM nginx:1.28-alpine AS runtime
# Bỏ server mặc định; cấu hình ProCV nằm trong conf.d + snippets.
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/procv.conf /etc/nginx/conf.d/procv.conf
COPY docker/nginx/snippets/ /etc/nginx/snippets/
# Endpoint báo cáo CSP (Sentry security) dựng từ DSN frontend; DSN trống thì CSP không
# báo cáo. ARG phải khai lại trong stage này (ARG không truyền giữa các stage).
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=
RUN --mount=type=bind,source=docker/nginx/render-csp.sh,target=/tmp/render-csp.sh \
    sh /tmp/render-csp.sh /etc/nginx/snippets/csp.conf "$VITE_SENTRY_DSN" "$VITE_SENTRY_ENVIRONMENT"
# Trang bảo trì khi backend không trả lời (502/503/504 do nginx sinh ra).
COPY docker/nginx/errors/ /usr/share/nginx/errors/
COPY --from=build /app/dist /usr/share/nginx/procv
EXPOSE 80 443 8080
