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

  it('uses resubmit copy while an article is waiting for approval', () => {
    expect(getActionCopy('submit', 'pending')[2]).toBe('Gửi duyệt lại')
    expect(getActionCopy('submit', 'published_with_pending')[2]).toBe('Gửi duyệt lại')
    expect(getActionCopy('submit', 'draft')[2]).toBe('Gửi duyệt')
  })
})
