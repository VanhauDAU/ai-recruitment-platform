const STATUS_LABELS = {
  active: 'Đang hoạt động',
  inactive: 'Tạm khóa',
  banned: 'Đã cấm',
  pending: 'Chờ kích hoạt',
}

const sumCounts = (rows = []) => rows.reduce((total, row) => total + (row.count || 0), 0)

/** Impact preview → one-line facts, notes and blockers for ImpactFacts. */
export function statusImpactFacts(operation, impact) {
  if (!impact) return { facts: [], notes: [], blockers: [] }
  const effects = impact.effects || {}
  const facts = []
  if (operation?.kind === 'status') {
    facts.push({
      label: 'Trạng thái',
      value: `${STATUS_LABELS[impact.before?.status] || impact.before?.status} → ${STATUS_LABELS[impact.after?.status] || impact.after?.status}`,
    })
  }
  if (operation?.kind !== 'resource-hold') {
    const sessions = impact.active_session_count ?? 0
    facts.push({
      label: 'Phiên bị đăng xuất',
      value: operation?.kind === 'sessions' || impact.sessions_will_be_revoked ? sessions : 0,
      tone: sessions && (operation?.kind === 'sessions' || impact.sessions_will_be_revoked) ? 'warning' : undefined,
    })
  }
  if (operation?.kind === 'resource-hold') {
    facts.push(
      { label: 'Chiến dịch được gỡ giữ', value: impact.campaign_count ?? 0 },
      { label: 'Tin được gỡ giữ', value: impact.job_count ?? 0 },
    )
  }
  if (effects.jobs) facts.push({ label: 'Tin tuyển dụng', value: sumCounts(effects.jobs) })
  if (effects.campaigns) facts.push({ label: 'Chiến dịch', value: sumCounts(effects.campaigns) })
  if (effects.open_application_count !== undefined) {
    facts.push({ label: 'Hồ sơ đang xử lý', value: effects.open_application_count })
  }
  if (effects.affected_candidate_count !== undefined) {
    facts.push({ label: 'Ứng viên liên quan', value: effects.affected_candidate_count })
  }
  if (effects.cv_count !== undefined) facts.push({ label: 'CV được giữ nguyên', value: effects.cv_count })

  const blockers = [...(impact.blocked_reasons || [])]
  if (operation?.kind === 'sessions' && impact.can_apply === false && !blockers.length) {
    blockers.push('Tài khoản không còn phiên đăng nhập nào để thu hồi.')
  }
  return {
    facts,
    notes: impact.restoration_policy ? [impact.restoration_policy] : [],
    blockers,
  }
}

/** Rows of `{status, policy_hold, count}` behind "Xem chi tiết". */
export function statusImpactBreakdown(impact) {
  const effects = impact?.effects || {}
  return [
    ['Tin tuyển dụng', effects.jobs],
    ['Chiến dịch', effects.campaigns],
    ['Hồ sơ ứng tuyển', effects.applications],
  ]
    .filter(([, rows]) => rows?.length)
    .map(([label, rows]) => ({
      label,
      value: rows
        .map((row) => `${row.status}${row.policy_hold ? ` (${row.policy_hold})` : ''}: ${row.count}`)
        .join(' · '),
    }))
}
