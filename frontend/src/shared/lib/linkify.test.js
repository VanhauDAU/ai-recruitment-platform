import { describe, expect, it } from 'vitest'
import { linkifyParts } from './linkify'

describe('linkifyParts', () => {
  it('splits plain text into text and link parts, leaving trailing punctuation out of the link', () => {
    expect(linkifyParts('Xem https://procv.site/viec-lam, rồi www.example.com.')).toEqual([
      { type: 'text', value: 'Xem ' },
      { type: 'link', value: 'https://procv.site/viec-lam', href: 'https://procv.site/viec-lam' },
      { type: 'text', value: ', rồi ' },
      { type: 'link', value: 'www.example.com', href: 'https://www.example.com' },
      { type: 'text', value: '.' },
    ])
  })

  it('never treats markup or other schemes as links', () => {
    expect(linkifyParts('<b>hi</b> javascript:alert(1)')).toEqual([
      { type: 'text', value: '<b>hi</b> javascript:alert(1)' },
    ])
  })
})
