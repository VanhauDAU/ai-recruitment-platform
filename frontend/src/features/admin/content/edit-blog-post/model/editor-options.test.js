// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getActionCopy, toFormValues } from './editor-options'

describe('blog editor form mapping', () => {
  it('does not expose the server-owned slug as an editable form value', () => {
    const values = toFormValues({
      title: 'Nhân viên Sales là gì?',
      slug: 'nhan-vien-sales-la-gi',
      category: { public_id: 'pcat_1' },
      tags: [],
    })

    expect(values.title).toBe('Nhân viên Sales là gì?')
    expect(values).not.toHaveProperty('slug')
  })

  it('warns that publishing an edit replaces the live post', () => {
    expect(getActionCopy('publish', 'published_with_draft')[0]).toBe('Xuất bản bản sửa')
    expect(getActionCopy('publish', 'draft')[0]).toBe('Xuất bản')
  })
})
