export function isVietnameseMobile(value) {
  const compact = (value || '').replace(/[ .()-]/g, '')
  return /^(0[35789]\d{8}|\+84[35789]\d{8})$/.test(compact)
}
