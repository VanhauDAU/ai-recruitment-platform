import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteEmployerCompanyCover, uploadEmployerCompanyCover } from './employer-profile.api'

const client = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: client }))

describe('company cover media API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads a prepared cover session into the given update request', async () => {
    client.post.mockResolvedValue({ data: { cover_image_url: 'https://cdn.example/cover.png' } })

    await uploadEmployerCompanyCover(new File(['x'], 'cover.png'), { uploadSession: { public_id: 'ups_1' }, updateRequest: 'cur_1' })

    const [url, body] = client.post.mock.calls[0]
    expect(url).toBe('/employer/company/cover/')
    expect(body.get('upload_session')).toBe('ups_1')
    expect(body.get('update_request')).toBe('cur_1')
  })

  it('deletes the cover through the same resource', async () => {
    client.delete.mockResolvedValue({ data: { detail: 'ok' } })

    await expect(deleteEmployerCompanyCover()).resolves.toEqual({ detail: 'ok' })
    expect(client.delete).toHaveBeenCalledWith('/employer/company/cover/')
  })
})
