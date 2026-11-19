const TAX_STATUS_LABELS = {
  missing: 'Chưa tra cứu',
  pending: 'Đang chờ tra cứu',
  matched: 'Khớp nguồn thuế',
  mismatch: 'Không khớp',
  not_found: 'Không tìm thấy',
  unavailable: 'Nguồn thuế lỗi',
  invalid: 'Bằng chứng không hợp lệ',
}

/** Decision / lifecycle impact → one-line facts and notes for ImpactFacts. */
export function decisionImpactFacts(impact, { lifecycle = false } = {}) {
  if (!impact) return { facts: [], notes: [] }
  const resources = impact.resources || impact.verification_hold_impact || {}
  const facts = []
  if (impact.tax_advisory) {
    facts.push({
      label: 'Mã số thuế',
      value: TAX_STATUS_LABELS[impact.tax_advisory.status] || impact.tax_advisory.status,
      tone: impact.tax_advisory.status === 'matched' ? 'success' : 'warning',
    })
  }
  if (impact.tax_override) facts.push({ label: 'Cách duyệt', value: 'Duyệt thủ công', tone: 'warning' })
  facts.push(
    { label: 'Chiến dịch', value: resources.campaign_count || 0 },
    { label: 'Tin tuyển dụng', value: resources.job_count || 0 },
  )
  if (Number.isInteger(resources.active_jobs_hidden_from_public)) {
    facts.push({
      label: 'Tin bị ẩn khỏi trang công khai',
      value: resources.active_jobs_hidden_from_public,
      tone: resources.active_jobs_hidden_from_public ? 'warning' : undefined,
    })
  }
  if (Number.isInteger(resources.active_jobs_to_unhide)) {
    facts.push({ label: 'Tin được hiện lại', value: resources.active_jobs_to_unhide, tone: 'success' })
  }
  const rejection = impact.decision === 'rejected' ? impact.rejection_impact : null
  if (rejection) {
    facts.push({
      label: 'Lượt từ chối',
      value: `${rejection.next_count}/${rejection.limit}`,
      tone: rejection.will_lock_resubmission ? 'danger' : 'warning',
    })
  }
  const notes = [
    lifecycle
      ? 'Khóa quyền đăng tin và xem dữ liệu ứng viên; bản nháp vẫn được giữ.'
      : 'Chỉ áp dụng cho nhà tuyển dụng này; hồ sơ công ty không đổi.',
  ]
  if (rejection?.will_lock_resubmission) {
    notes.push('Xác nhận sẽ khóa nộp lại; nhà tuyển dụng vẫn xem được lý do và gửi khiếu nại.')
  }
  return { facts, notes }
}
