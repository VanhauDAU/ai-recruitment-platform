import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAdminBlogPost,
  createAdminBlogPin,
  getAdminBlogMedia,
  getAdminBlogPosts,
  mergeAdminBlogTag,
  reorderAdminBlogCategories,
  runAdminBlogAction,
  saveAdminBlogDraft,
} from './blog-admin.api'

const { get, invalidateRequestCache, patch, post } = vi.hoisted(() => ({
  get: vi.fn(),
  invalidateRequestCache: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))
vi.mock('@/shared/api/request-deduplication', () => ({ invalidateRequestCache }))

describe('blog admin API', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: {} })
    patch.mockReset().mockResolvedValue({ data: {} })
    post.mockReset().mockResolvedValue({ data: {} })
    invalidateRequestCache.mockReset()
  })

  it('keeps list filters and cancellation signal intact', async () => {
    const params = { q: 'sales', status: 'pending', page: 2 }
    await getAdminBlogPosts(params, { signal: 'signal' })
    expect(get).toHaveBeenCalledWith('/blog/admin/posts/', { params, signal: 'signal' })
  })

  it('loads the reusable media library with search and cancellation', async () => {
    await getAdminBlogMedia({ q: 'sales' }, { signal: 'media-signal' })
    expect(get).toHaveBeenCalledWith('/blog/admin/uploads/', {
      params: { q: 'sales' },
      signal: 'media-signal',
    })
  })

  it('uses the draft revision endpoint for optimistic autosave', async () => {
    const payload = { title: 'Bài mới', base_revision: 4 }
    await saveAdminBlogDraft('ps_123', payload)
    expect(patch).toHaveBeenCalledWith('/blog/admin/posts/ps_123/draft/', payload)
  })

  it('creates without a client-controlled slug and posts explicit workflow actions', async () => {
    const payload = { title: 'Nhân viên Sales là gì?', category_public_id: 'pcat_1' }
    await createAdminBlogPost(payload)
    await runAdminBlogAction('ps_123', 'submit', {})
    expect(post).toHaveBeenNthCalledWith(1, '/blog/admin/posts/', payload)
    expect(post).toHaveBeenNthCalledWith(2, '/blog/admin/posts/ps_123/submit/', {})
  })

  it('merges a source tag into an explicit target', async () => {
    await mergeAdminBlogTag('ptag_source', 'ptag_target')
    expect(post).toHaveBeenCalledWith('/blog/admin/tags/ptag_source/merge/', {
      target_public_id: 'ptag_target',
    })
  })

  it('creates a pin without requiring placement and clears the public pin cache', async () => {
    const payload = { post_public_id: 'ps_123', order: 1, is_active: true }
    await createAdminBlogPin(payload)
    expect(post).toHaveBeenCalledWith('/blog/admin/pins/', payload)
    expect(invalidateRequestCache).toHaveBeenCalledWith('blog-pinned')
  })

  it('reorders categories and clears public category caches', async () => {
    await reorderAdminBlogCategories(['pcat_2', 'pcat_1'])
    expect(post).toHaveBeenCalledWith('/blog/admin/categories/reorder/', {
      public_ids: ['pcat_2', 'pcat_1'],
    })
    expect(invalidateRequestCache).toHaveBeenCalledWith('blog-categories')
    expect(invalidateRequestCache).toHaveBeenCalledWith('blog-home')
  })
})
