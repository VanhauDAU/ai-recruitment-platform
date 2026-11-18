import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCvFromTemplate } from './create-cv.api'
const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { post } }))

describe('create CV from template API', () => {
  beforeEach(() => post.mockReset())

  it('creates through the V2 CV lifecycle endpoint', async () => {
    const payload = {
      title: 'CV thiết kế',
      template_public_id: 'cvtemplate_modern',
      position_public_id: 'jobcat_designer',
      language: 'vi-VN',
      theme_color: '#2255AA',
    }
    const created = { public_id: 'cv_new' }
    post.mockResolvedValue({ data: created })

    await expect(createCvFromTemplate(payload)).resolves.toEqual(created)
    expect(post).toHaveBeenCalledWith('/v2/cvs/', payload, undefined)
  })

  it('sends the idempotency key so a repeated click returns the same CV', async () => {
    post.mockResolvedValue({ data: { public_id: 'cv_new' } })

    await createCvFromTemplate({ title: 'CV' }, { idempotencyKey: 'click-1' })
    expect(post).toHaveBeenCalledWith('/v2/cvs/', { title: 'CV' }, { headers: { 'Idempotency-Key': 'click-1' } })
  })
})
