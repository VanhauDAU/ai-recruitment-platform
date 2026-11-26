// Trang chi tiết thay thanh tab dưới bằng thanh hành động (body.has-bottom-action-bar),
// nên trên điện thoại header có nút quay lại. Mở thẳng từ link chia sẻ / tab mới thì
// không có trang trước trong app: nút về trang danh sách tương ứng.
const DETAIL_ROUTES = [
  [/^\/viec-lam\/[^/]+$/, '/viec-lam'],
  [/^\/brand\/[^/]+\/tuyen-dung\/[^/]+$/, '/viec-lam'],
  [/^\/mau-cv-tieng-anh\/chi-tiet\/[^/]+$/, '/mau-cv-tieng-anh'],
  [/^\/(mau-cv\/chi-tiet|cv-templates)\/[^/]+$/, '/mau-cv'],
  [/^\/cong-ty\/(?!tim-kiem$)[^/]+$/, '/cong-ty'],
]

/** Trang danh sách để lùi về khi đang ở trang chi tiết, hoặc `null`. */
export function detailBackFallback(pathname) {
  return DETAIL_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}
