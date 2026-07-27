function sessionKey(session) {
  if (!session.ip_address || !session.device_label) return session.id
  return `${session.portal}:${session.ip_address}:${session.device_label}`
}

/**
 * Hiển thị một dòng cho mỗi thiết bị/IP. Backend vẫn lưu phiên riêng để thu hồi
 * JWT chính xác, còn UI tránh lặp nhiều dòng cùng Chrome trên cùng mạng.
 */
export function groupSessions(sessions) {
  const groups = new Map()
  for (const session of sessions) {
    const key = sessionKey(session)
    const existing = groups.get(key)
    if (!existing || session.current || (!existing.current && !session.revoked_at && existing.revoked_at)) {
      groups.set(key, session)
    }
  }
  return [...groups.values()]
}
