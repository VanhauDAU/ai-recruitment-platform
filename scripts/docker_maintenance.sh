#!/bin/sh
set -eu

# Chỉ giới hạn cache phục vụ build. Không prune image, container, network hay
# volume để tránh xóa dữ liệu PostgreSQL, media và model đã tải.
max_cache="${DOCKER_BUILD_CACHE_MAX:-5gb}"

docker buildx prune --all --force --max-used-space "$max_cache"
docker system df
