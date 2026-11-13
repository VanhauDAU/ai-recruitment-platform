import { getCvTemplatePreview } from '@/entities/cv'
import { getBlankCvPreview, getCvPositionPreview } from '@/entities/cv-template'

export function resolvePreviewSelection({
  source,
  locale,
  sampleLocale,
  positionsLocale,
  positions,
  loadingPositions,
  selectedPosition,
  selectedCvId,
  templatePublicId,
}) {
  if (source === 'upload') return { state: 'unavailable' }
  if (source === 'sample' && (positionsLocale !== sampleLocale || !selectedPosition)) {
    return {
      state: !loadingPositions && positionsLocale === sampleLocale && positions.length === 0
        ? 'empty'
        : 'waiting',
    }
  }
  if (source === 'previous' && !selectedCvId) return { state: 'waiting' }
  if (source === 'blank') {
    return { state: 'ready', load: (signal) => getBlankCvPreview(locale, templatePublicId, { signal }) }
  }
  if (source === 'previous') {
    return { state: 'ready', load: (signal) => getCvTemplatePreview(selectedCvId, templatePublicId, signal) }
  }
  return {
    state: 'ready',
    load: (signal) => getCvPositionPreview(selectedPosition, sampleLocale, templatePublicId, { signal }),
  }
}
