export function pickLocalized(record, field, language = 'vi') {
  if (!record || !field) return ''
  const locale = language === 'en' ? 'en' : 'vi'
  const localized = record[`${field}_${locale}`]
  const hasLocalizedValue = Array.isArray(localized) ? localized.length > 0 : Boolean(localized)
  return hasLocalizedValue ? localized : (record[`${field}_vi`] || '')
}
