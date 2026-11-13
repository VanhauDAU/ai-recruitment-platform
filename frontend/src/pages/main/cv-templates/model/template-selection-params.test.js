import { describe, expect, it } from 'vitest'
import { searchParamsFromSelection, selectionFromSearchParams, templateHeading } from './template-selection-params'

describe('template selection query params', () => {
  it('round-trips a sample selection and omits defaults', () => {
    const params = searchParamsFromSelection(
      { source: 'sample', positionSlug: 'ky-su-ai', sampleLocale: 'en-US', experienceBand: 'senior', colorSlug: 'xanh' },
      { pathLocale: 'vi-VN', defaultColorSlug: 'xanh-la' },
    )

    expect(params.toString()).toBe('vi-tri=ky-su-ai&kinh-nghiem=senior&ngon-ngu=en&mau=xanh')
    expect(selectionFromSearchParams(params, 'vi-VN')).toEqual({
      source: 'sample',
      positionSlug: 'ky-su-ai',
      sampleLocale: 'en-US',
      experienceBand: 'senior',
      colorSlug: 'xanh',
    })
    // Mức mặc định (1–2 năm) không đưa lên URL; giá trị lạ quay về mặc định.
    expect(searchParamsFromSelection({ source: 'sample', experienceBand: 'junior' }, { pathLocale: 'vi-VN' }).has('kinh-nghiem')).toBe(false)
    expect(selectionFromSearchParams(new URLSearchParams('kinh-nghiem=expert'), 'vi-VN').experienceBand).toBe('junior')
  })

  it('keeps only the source for non-sample selections and never a CV id', () => {
    const params = searchParamsFromSelection(
      { source: 'previous', positionSlug: 'ky-su-ai', sampleLocale: 'en-US', colorSlug: 'xanh-la' },
      { pathLocale: 'vi-VN', defaultColorSlug: 'xanh-la' },
    )

    expect(params.toString()).toBe('nguon=cv-cu')
  })

  it('ignores unknown values', () => {
    const selection = selectionFromSearchParams(new URLSearchParams('nguon=khoi-phuc&ngon-ngu=ja'), 'en-US')

    expect(selection).toMatchObject({ source: 'sample', sampleLocale: 'en-US' })
  })

  it('builds the heading from the selected position and content language', () => {
    expect(templateHeading({ templateName: 'Thanh Lịch', source: 'sample', positionLabel: 'Kỹ sư AI', language: 'en-US' }))
      .toBe('Mẫu CV Kỹ sư AI tiếng Anh - Thanh Lịch')
    expect(templateHeading({ templateName: 'Thanh Lịch', source: 'blank', positionLabel: 'Kỹ sư AI', language: 'vi-VN' }))
      .toBe('Mẫu CV tiếng Việt - Thanh Lịch')
  })
})
