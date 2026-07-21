# Build vite -> serve tĩnh bằng nginx. Biến VITE_* phải có LÚC BUILD
# (vite inline vào bundle) — truyền qua build args.
FROM node:22-alpine AS build

ARG VITE_API_BASE_URL
ARG VITE_RECAPTCHA_SITE_KEY=
ARG VITE_PUBLIC_ASSET_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY \
    VITE_PUBLIC_ASSET_BASE_URL=$VITE_PUBLIC_ASSET_BASE_URL

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
