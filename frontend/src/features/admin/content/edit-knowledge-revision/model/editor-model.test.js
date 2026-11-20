// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { editorCompletion, revisionToEditorValues } from './editor-model'

describe('knowledge revision editor model', () => {
  it('edits the open draft and keeps its change summary', () => {
    const values = revisionToEditorValues({
      category: { public_id: 'kbc_1' },
      article_type: 'FAQ',
      revisions: [
        { number: 3, status: 'DRAFT', title: 'Draft', change_summary: 'Thêm bước 3' },
        { number: 2, status: 'PUBLISHED', title: 'Live', change_summary: 'Bản cũ' },
      ],
    })
    expect(values).toEqual(expect.objectContaining({ title: 'Draft', change_summary: 'Thêm bước 3' }))
  })

  it('starts a new draft from the latest published revision with an empty change summary', () => {
    const values = revisionToEditorValues({
      category: { public_id: 'kbc_1' },
      article_type: 'FAQ',
      revisions: [{ number: 2, status: 'PUBLISHED', title: 'Live', change_summary: 'Bản cũ' }],
    })
    expect(values).toEqual(expect.objectContaining({ title: 'Live', change_summary: '' }))
  })

  it('reports readiness without treating empty markup as content', () => {
    expect(editorCompletion({ title: 'FAQ', body: '<p></p>' }).completed).toBe(1)
  })
})
