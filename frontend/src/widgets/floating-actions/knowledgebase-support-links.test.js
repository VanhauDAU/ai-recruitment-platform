import { describe, expect, it } from 'vitest'
import { knowledgebaseSupportLinks } from './knowledgebase-support-links'

describe('floating Help Center links', () => {
  it('fails closed while the backend capability is unavailable', () => {
    expect(knowledgebaseSupportLinks(false)).toEqual([])
  })

  it('replaces both former placeholders with canonical Help Center routes', () => {
    expect(knowledgebaseSupportLinks(true)).toEqual([
      expect.objectContaining({
        key: 'safety',
        path: '/tro-giup/tim-viec-an-toan',
      }),
      expect.objectContaining({
        key: 'faq',
        path: '/tro-giup',
      }),
    ])
  })
})
