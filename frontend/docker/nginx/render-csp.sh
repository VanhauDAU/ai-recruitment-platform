#!/bin/sh
# Điền endpoint báo cáo CSP vào snippets/csp.conf lúc build image `web`
# (frontend/Dockerfile, stage runtime). Chạy bằng sh của nginx:alpine (busybox).
#   sh render-csp.sh /etc/nginx/snippets/csp.conf "$VITE_SENTRY_DSN" "$VITE_SENTRY_ENVIRONMENT"
#
# DSN của project Sentry frontend `https://KEY@HOST/PROJECT` thành endpoint security:
#   https://HOST/api/PROJECT/security/?sentry_key=KEY&sentry_environment=ENV
# rồi thay placeholder `__CSP_REPORT__` ở cuối policy bằng
# `; report-uri <url>; report-to csp-endpoint` và thêm header Reporting-Endpoints
# (report-to cần header này; report-uri cho trình duyệt chưa hỗ trợ report-to).
# Header mới nằm ngay trong csp.conf nên có mặt ở đúng mọi context có CSP.
# DSN trống: xóa placeholder, policy không báo cáo. DSN sai dạng: build lỗi.
set -eu

conf="${1:?cần đường dẫn csp.conf}"
dsn="${2:-}"
environment="${3:-}"
# Khớp mặc định của SDK (frontend/src/shared/lib/error-reporting.js).
environment="${environment:-production}"

grep -q '__CSP_REPORT__' "$conf" || {
  echo "render-csp: $conf không có placeholder __CSP_REPORT__" >&2
  exit 1
}

if [ -z "$dsn" ]; then
  sed -i "/^add_header Content-Security-Policy/ s/__CSP_REPORT__//" "$conf"
  echo "render-csp: không có VITE_SENTRY_DSN, CSP không gửi báo cáo."
else
  scheme="${dsn%%://*}"
  rest="${dsn#*://}"
  key="${rest%%@*}"
  host_path="${rest#*@}"
  host="${host_path%%/*}"
  project="${host_path##*/}"
  # Ký tự hợp lệ của từng phần; chặn luôn ký tự phá chuỗi nginx/sed (" ' | & ; $ \ khoảng trắng).
  case "$scheme" in https | http) ;; *) scheme="" ;; esac
  if [ -z "$scheme" ] || [ "$rest" = "$key" ] || [ -z "$key" ] || [ -z "$host" ] \
    || [ -z "$project" ] \
    || printf '%s' "$key" | grep -q '[^A-Za-z0-9]' \
    || printf '%s' "$host" | grep -q '[^A-Za-z0-9.:-]' \
    || printf '%s' "$project" | grep -q '[^0-9]' \
    || printf '%s' "$environment" | grep -q '[^A-Za-z0-9._-]'; then
    echo "render-csp: VITE_SENTRY_DSN/VITE_SENTRY_ENVIRONMENT sai dạng (cần https://KEY@HOST/PROJECT)." >&2
    exit 1
  fi
  # Sentry tự host dưới đường dẫn con (https://KEY@HOST/sentry/PROJECT) giữ tiền tố đó.
  prefix="${host_path#"$host"}"
  prefix="${prefix%/*}"
  if printf '%s' "$prefix" | grep -q '[^A-Za-z0-9/._-]'; then
    echo "render-csp: đường dẫn trong VITE_SENTRY_DSN sai dạng." >&2
    exit 1
  fi
  url="$scheme://$host$prefix/api/$project/security/?sentry_key=$key&sentry_environment=$environment"
  # Trong vế thay thế của sed, & là "chuỗi khớp": phải thoát.
  sed_url="$(printf '%s' "$url" | sed 's/&/\\\&/g')"
  sed -i "/^add_header Content-Security-Policy/ s|__CSP_REPORT__|; report-uri $sed_url; report-to csp-endpoint|" "$conf"
  printf "add_header Reporting-Endpoints 'csp-endpoint=\"%s\"' always;\n" "$url" >>"$conf"
  echo "render-csp: CSP báo cáo về $scheme://$host$prefix/api/$project/security/ (env $environment)."
fi

if grep -q '__CSP_REPORT__' "$conf"; then
  echo "render-csp: còn placeholder trong $conf" >&2
  exit 1
fi
