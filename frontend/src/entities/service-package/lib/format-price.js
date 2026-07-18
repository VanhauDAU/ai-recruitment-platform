const FORMATTERS = {
  vi: new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
}

export function formatServicePrice(price, currency = 'VND', language = 'vi') {
  if (price == null || price === '') return null
  const locale = language === 'en' ? 'en' : 'vi'
  const amount = Number(price)
  if (!Number.isFinite(amount)) return null
  const formatted = FORMATTERS[locale].format(amount)
  return currency === 'VND' ? `${formatted} ₫` : `${formatted} ${currency}`
}
