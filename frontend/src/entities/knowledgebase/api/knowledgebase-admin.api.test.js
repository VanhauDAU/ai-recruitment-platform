import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAdminKnowledgeArticles,
  getAdminKnowledgeMedia,
  runAdminKnowledgeRevisionAction,
  setAdminKnowledgeCategoryActive,
  updateAdminKnowledgeRevision,
  uploadAdminKnowledgeMedia,
} from './knowledgebase-admin.api'

const { get, patch, post } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('knowledgebase admin API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: {} })
    patch.mockReset().mockResolvedValue({ data: {} })
    post.mockReset().mockResolvedValue({ data: {} })
  })

  it('keeps server filters and AbortSignal on article lists', async () => {
    const params = { q: 'đăng nhập', revision_status: 'IN_REVIEW', page: 2 }
    await getAdminKnowledgeArticles(params, { signal: 'signal' })
    expect(get).toHaveBeenCalledWith('/knowledgebase/admin/articles/', { params, signal: 'signal' })
  })

  it('sends revision tokens on category and editorial mutations', async () => {
    await setAdminKnowledgeCategoryActive('kbc_1', false, 4)
    await updateAdminKnowledgeRevision('kba_1', 2, { title: 'Mới', revision_token: 8 })
    await runAdminKnowledgeRevisionAction('kba_1', 2, 'approve', { revision_token: 9 })
    expect(post).toHaveBeenNthCalledWith(1, '/knowledgebase/admin/categories/kbc_1/deactivate/', { revision_token: 4 })
    expect(patch).toHaveBeenCalledWith('/knowledgebase/admin/articles/kba_1/revisions/2/', { title: 'Mới', revision_token: 8 })
    expect(post).toHaveBeenNthCalledWith(2, '/knowledgebase/admin/articles/kba_1/revisions/2/approve/', { revision_token: 9 })
  })

  it('adapts backend media metadata to the shared image library', async () => {
    get.mockResolvedValue({ data: { results: [{ public_id: 'kbm_1', size_bytes: 1200, default_alt_text: 'Ảnh CV' }] } })
    const response = await getAdminKnowledgeMedia()
    expect(response.results[0]).toEqual(expect.objectContaining({ size: 1200, alt: 'Ảnh CV' }))

    post.mockResolvedValue({ data: { public_id: 'kbm_2', size_bytes: 42, default_alt_text: 'Mới' } })
    const uploaded = await uploadAdminKnowledgeMedia(new File(['x'], 'faq.webp', { type: 'image/webp' }))
    expect(post).toHaveBeenCalledWith('/knowledgebase/admin/media/', expect.any(FormData))
    expect(uploaded).toEqual(expect.objectContaining({ size: 42, alt: 'Mới' }))
  })
})
