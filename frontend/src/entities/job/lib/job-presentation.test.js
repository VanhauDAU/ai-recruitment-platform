import { describe, expect, it } from 'vitest'
import { jobCardToneClass, resolveJobPresentation } from './job-presentation'

describe('job candidate presentation', () => {
  it('prefers the backend projection over legacy package fields', () => {
    const projection = {
      sponsored: true,
      card_tone: 'orange',
      labels: [{ code: 'sponsored', text: 'Tài trợ', tone: 'sponsored' }],
      placement: 'sponsored_search',
    }

    expect(resolveJobPresentation({ tier: 'top', presentation: projection })).toBe(projection)
    expect(jobCardToneClass({ presentation: projection })).toContain('orange')
  })

  it('keeps a compatibility projection while legacy clients are rolling out', () => {
    expect(resolveJobPresentation({ tier: 'featured', is_urgent: true })).toMatchObject({
      sponsored: true,
      card_tone: 'orange',
      labels: [
        { code: 'sponsored', text: 'Tài trợ' },
        { code: 'urgent', text: 'GẤP' },
      ],
    })
  })

  it('supports the strongest commercial card tone without package-name mapping', () => {
    expect(jobCardToneClass({
      presentation: { card_tone: 'green_strong', labels: [], sponsored: true },
    })).toContain('bg-emerald-100')
  })
})
