import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

import { createCvFromTemplate } from './create-cv.api'

describe('create CV from template API', () => {
  beforeEach(() => post.mockReset())

  it('creates through the V2 CV lifecycle endpoint', async () => {
    const payload = {
      title: 'CV thiết kế',
      template_public_id: 'cvtemplate_modern',
      sample_content_public_id: 'cvsample_designer',
      language: 'vi-VN',
    }
    const created = { public_id: 'cv_new' }
    post.mockResolvedValue({ data: created })

    await expect(createCvFromTemplate(payload)).resolves.toEqual(created)
    expect(post).toHaveBeenCalledWith('/v2/cvs/', payload)
  })
})
