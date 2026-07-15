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
  recoverable,
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
  const sourceCvId = source === 'previous'
    ? selectedCvId
    : (source === 'restore' ? recoverable?.cv?.public_id : null)
  if ((source === 'previous' || source === 'restore') && !sourceCvId) return { state: 'empty' }
  if (source === 'blank') {
    return { state: 'ready', load: (signal) => getBlankCvPreview(locale, templatePublicId, { signal }) }
  }
  if (source === 'previous' || source === 'restore') {
    return { state: 'ready', load: (signal) => getCvTemplatePreview(sourceCvId, templatePublicId, signal) }
  }
  return {
    state: 'ready',
    load: (signal) => getCvPositionPreview(selectedPosition, sampleLocale, templatePublicId, { signal }),
  }
}
