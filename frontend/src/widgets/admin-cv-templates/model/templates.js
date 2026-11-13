// Trạng thái hiển thị của template trên kho mẫu công khai.
export const STATUS_TAGS = {
  published: ['green', 'Đang hiển thị'],
  draft: ['gold', 'Chưa xuất bản'],
  archived: ['default', 'Đã ẩn'],
}

export const draftVersion = (template) => (template?.versions || []).find((version) => version.version_status === 'draft')
export const publishedVersion = (template) => (template?.versions || []).find((version) => version.id === template.current_published_version_id)

// Bố cục đang làm việc: bản nháp nếu có, không thì bản đang xuất bản.
export const currentRendererKey = (template) => (draftVersion(template) || publishedVersion(template))?.renderer_key

// Thay (hoặc thêm) một phiên bản trong template đang cache sau khi lưu.
export function replaceVersion(template, version) {
  if (!template || !version) return template
  const exists = template.versions.some((item) => item.id === version.id)
  return { ...template, versions: exists ? template.versions.map((item) => (item.id === version.id ? version : item)) : [version, ...template.versions] }
}

// Hai cờ của một mục (bắt buộc, bật sẵn) gộp thành một lựa chọn dễ hiểu.
export const SECTION_STATES = [
  { value: 'required', label: 'Bắt buộc', flags: { is_required: true, is_default_enabled: true } },
  { value: 'on', label: 'Bật sẵn', flags: { is_required: false, is_default_enabled: true } },
  { value: 'off', label: 'Ẩn sẵn', flags: { is_required: false, is_default_enabled: false } },
]
export const sectionState = (row) => (row.is_required ? 'required' : row.is_default_enabled ? 'on' : 'off')
export const sectionFlags = (state) => SECTION_STATES.find((item) => item.value === state).flags

// Cặp cột cùng hàng mà ứng viên kéo được độ rộng (null nếu layout không có).
export function resizablePair(contract) {
  if (!contract?.resize) return null
  const rows = Object.groupBy(contract.regions, (region) => region.row)
  return Object.values(rows).find((row) => row.length === 2) || null
}

// Các điều kiện xuất bản chưa đạt của bản nháp.
export const failingChecks = (checklist) => (checklist?.items || []).filter((item) => !item.ok)
