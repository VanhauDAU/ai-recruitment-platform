import { describe, expect, it } from 'vitest'
import { getEditorCompletion } from './editor-completion'

describe('blog editor completion', () => {
  it('tracks required and recommended editorial fields', () => {
    expect(getEditorCompletion({ title: 'Nghề Sales', summary: 'Tổng quan nghề Sales' })).toEqual({
      checks: {
        title: true,
        summary: true,
        content: false,
        thumbnail: false,
        related_job_category: false,
        seo_title: false,
        seo_description: false,
      },
      score: 29,
    })
  })
})
