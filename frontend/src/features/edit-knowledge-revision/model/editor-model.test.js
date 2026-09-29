import { describe, expect, it } from 'vitest'
import { editorCompletion, revisionToEditorValues } from './editor-model'

describe('knowledge revision editor model', () => {
  it('prefers the open draft instead of a newer rejected revision', () => {
    const values = revisionToEditorValues({
      category: { public_id: 'kbc_1' },
      article_type: 'FAQ',
      revisions: [
        { number: 3, status: 'REJECTED', title: 'Rejected' },
        { number: 2, status: 'DRAFT', title: 'Draft' },
      ],
    })
    expect(values.title).toBe('Draft')
  })

  it('reports readiness without treating empty markup as content', () => {
    expect(editorCompletion({ title: 'FAQ', body: '<p></p>' }).completed).toBe(1)
  })
})
