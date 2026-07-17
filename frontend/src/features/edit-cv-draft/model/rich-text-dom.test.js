import { describe, expect, it } from 'vitest'
import { richTextV2 } from '@/entities/cv'
import { domToRichText, renderRichText, restoreSelectionOffsets, selectionOffsets } from './rich-text-dom'

function selectText(root, start, end) {
  const text = root.querySelector('span').firstChild
  const range = globalThis.document.createRange()
  range.setStart(text, start)
  range.setEnd(text, end)
  const selection = globalThis.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('rich text DOM bridge', () => {
  it('round-trips canonical runs through editable DOM without duplicated text', () => {
    const root = globalThis.document.createElement('div')
    const value = { format: 'rich_text_v2', content: [{ type: 'paragraph', text: 'abcdef', runs: [{ text: 'abc', marks: { bold: true } }, { text: 'def' }] }] }

    renderRichText(root, value)

    expect(root).toHaveTextContent('abcdef')
    expect(root.querySelectorAll('span')).toHaveLength(2)
    expect(domToRichText(root)).toEqual(value)
  })

  it('restores the selected range after the editable DOM is rewritten for formatting', () => {
    const root = globalThis.document.createElement('div')
    globalThis.document.body.append(root)
    renderRichText(root, richTextV2('abcdef'))
    selectText(root, 1, 4)
    const offsets = selectionOffsets(root)

    renderRichText(root, richTextV2('abcdef'))
    restoreSelectionOffsets(root, offsets)

    expect(selectionOffsets(root)).toEqual({ start: 1, end: 4 })
    root.remove()
  })
})
