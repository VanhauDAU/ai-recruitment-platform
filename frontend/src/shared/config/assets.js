// Nguồn sự thật duy nhất cho base URL của asset tĩnh công khai (Cloudflare R2).
// Trước đây base URL bị hardcode lặp lại ở từng trang; gom về đây để đổi bucket
// theo môi trường chỉ bằng biến VITE_PUBLIC_ASSET_BASE_URL mà không sửa code.
//
// `legacyAsset(path)` trỏ tới bộ ảnh UI TopCV legacy đã copy sang R2 dưới tiền tố
// `frontend/legacy/` (xem backend command migrate_frontend_assets_to_r2).
const PUBLIC_ASSET_BASE_URL = (
  import.meta.env.VITE_PUBLIC_ASSET_BASE_URL || 'https://pub-8375cfb0dcca48ed8459003b91080f08.r2.dev'
).replace(/\/+$/, '')

export function publicAsset(pathname) {
  return `${PUBLIC_ASSET_BASE_URL}/${String(pathname).replace(/^\/+/, '')}`
}

export function legacyAsset(pathname) {
  return publicAsset(`frontend/legacy/${String(pathname).replace(/^\/+/, '')}`)
}
