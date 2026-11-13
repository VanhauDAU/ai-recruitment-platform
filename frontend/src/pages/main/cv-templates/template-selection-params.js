// Đồng bộ lựa chọn ở cột phải trang chi tiết mẫu CV với query string.
// Chỉ đưa dữ liệu không nhạy cảm lên URL: không có mã CV, tên tệp hay dữ liệu
// cá nhân. Giá trị mặc định bị lược bỏ để URL gọn và canonical ổn định.
import { CV_LANGUAGES, DEFAULT_CV_EXPERIENCE_BAND, cvLanguage, isCvExperienceBand } from '@/entities/cv-template'

const SOURCE_PARAMS = { sample: 'mau', previous: 'cv-cu', upload: 'tai-len', blank: 'trong' }
const PARAM_SOURCES = Object.fromEntries(Object.entries(SOURCE_PARAMS).map(([source, param]) => [param, source]))
const LANGUAGE_PARAMS = Object.fromEntries(CV_LANGUAGES.map((language) => [language.code, language.param]))
const PARAM_LANGUAGES = Object.fromEntries(CV_LANGUAGES.map((language) => [language.param, language.code]))

export function selectionFromSearchParams(params, pathLocale) {
  return {
    source: PARAM_SOURCES[params.get('nguon')] || 'sample',
    positionSlug: params.get('vi-tri') || null,
    sampleLocale: PARAM_LANGUAGES[params.get('ngon-ngu')] || pathLocale,
    experienceBand: isCvExperienceBand(params.get('kinh-nghiem')) ? params.get('kinh-nghiem') : DEFAULT_CV_EXPERIENCE_BAND,
    colorSlug: params.get('mau') || null,
  }
}

export function searchParamsFromSelection({ source, positionSlug, sampleLocale, experienceBand, colorSlug }, { pathLocale, defaultColorSlug }) {
  const params = new URLSearchParams()
  if (SOURCE_PARAMS[source] && source !== 'sample') params.set('nguon', SOURCE_PARAMS[source])
  if (source === 'sample') {
    if (positionSlug) params.set('vi-tri', positionSlug)
    if (isCvExperienceBand(experienceBand) && experienceBand !== DEFAULT_CV_EXPERIENCE_BAND) params.set('kinh-nghiem', experienceBand)
    if (LANGUAGE_PARAMS[sampleLocale] && sampleLocale !== pathLocale) params.set('ngon-ngu', LANGUAGE_PARAMS[sampleLocale])
  }
  if (colorSlug && colorSlug !== defaultColorSlug) params.set('mau', colorSlug)
  return params
}

export function templateHeading({ templateName, source, positionLabel, language }) {
  const position = source === 'sample' && positionLabel ? `${positionLabel} ` : ''
  return `Mẫu CV ${position}${cvLanguage(language).inlineLabel} - ${templateName}`
}
