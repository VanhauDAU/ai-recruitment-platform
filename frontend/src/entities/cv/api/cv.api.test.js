import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post, put } }))

import { getCv, getCvDraft, saveCvVersion, updateCvDraft } from './cv.api'

describe('CV V2 API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
  })

  it('uses draft optimistic locking and creates versions only through save-version', async () => {
    const document = { schema_version: 1, content_json: {}, layout_json: {}, style_json: {} }
    get.mockResolvedValueOnce({ data: { public_id: 'cv_1' } })
    get.mockResolvedValueOnce({ data: { lock_version: 3 }, headers: { etag: '"lock-version-3"' } })
    put.mockResolvedValue({ data: { lock_version: 4 }, headers: { etag: '"lock-version-4"' } })
    post.mockResolvedValue({ data: { public_id: 'version_4', version_kind: 'manual_save' } })

    await expect(getCv('cv_1')).resolves.toEqual({ public_id: 'cv_1' })
    await expect(getCvDraft('cv_1')).resolves.toEqual({ lock_version: 3, etag: '"lock-version-3"' })
    await expect(updateCvDraft('cv_1', document, 3, 'tab_a')).resolves.toEqual({ lock_version: 4, etag: '"lock-version-4"' })
    await expect(saveCvVersion('cv_1', 4)).resolves.toEqual({ public_id: 'version_4', version_kind: 'manual_save' })

    expect(put).toHaveBeenCalledWith('/v2/cvs/cv_1/draft/', { ...document, client_session_id: 'tab_a' }, { headers: { 'If-Match': '"lock-version-3"' } })
    expect(post).toHaveBeenCalledWith('/v2/cvs/cv_1/save-version/', undefined, { headers: { 'If-Match': '"lock-version-4"' } })
  })
})
