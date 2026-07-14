import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put, remove } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), remove: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, post, put, delete: remove } }))

import {
  createCvSharedLink,
  createCvPdfExport,
  downloadCvPdf,
  getCv,
  getCvDraft,
  getCvOwnerView,
  getCvPdfExport,
  getCvSharedLinks,
  getCvVersions,
  getSharedCv,
  publishCvVersion,
  revokeCvSharedLink,
  retryCvPdfExport,
  saveCvVersion,
  switchCvTemplate,
  updateCvDraft,
} from './cv.api'

describe('CV V2 API', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
    remove.mockReset()
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
    await expect(publishCvVersion('cv_1', 4)).resolves.toEqual({ public_id: 'version_4', version_kind: 'manual_save' })

    expect(put).toHaveBeenCalledWith('/v2/cvs/cv_1/draft/', { ...document, client_session_id: 'tab_a' }, { headers: { 'If-Match': '"lock-version-3"' } })
    expect(post).toHaveBeenCalledWith('/v2/cvs/cv_1/save-version/', undefined, { headers: { 'If-Match': '"lock-version-4"' } })
    expect(post).toHaveBeenCalledWith('/v2/cvs/cv_1/publish/', undefined, { headers: { 'If-Match': '"lock-version-4"' } })
  })

  it('switches a CV to a published template with the same optimistic lock contract', async () => {
    put.mockResolvedValue({
      data: { cv: { template_public_id: 'tpl_two' }, draft: { lock_version: 4 } },
      headers: { etag: '"lock-version-4"' },
    })

    await expect(switchCvTemplate('cv_1', 'tpl_two', 3, 'tab_a')).resolves.toEqual({
      cv: { template_public_id: 'tpl_two' }, draft: { lock_version: 4, etag: '"lock-version-4"' },
    })
    expect(put).toHaveBeenCalledWith(
      '/v2/cvs/cv_1/template/',
      { template_public_id: 'tpl_two', client_session_id: 'tab_a' },
      { headers: { 'If-Match': '"lock-version-3"' } },
    )
  })

  it('uses V2 immutable owner/share endpoints and never sends a share token as a write payload', async () => {
    get.mockResolvedValueOnce({ data: { cv: { title: 'CV immutable' }, version: { public_id: 'cvv_2' } } })
    get.mockResolvedValueOnce({ data: { cv: { title: 'CV shared' }, version: { public_id: 'cvv_2' } } })
    get.mockResolvedValueOnce({ data: [{ public_id: 'cvs_1' }] })
    post.mockResolvedValue({ data: { link: { public_id: 'cvs_1' }, token: 'raw-token-once' } })
    remove.mockResolvedValue({ data: {} })

    await expect(getCvOwnerView('cv_1')).resolves.toMatchObject({ version: { public_id: 'cvv_2' } })
    await expect(getSharedCv('token/with-space')).resolves.toMatchObject({ cv: { title: 'CV shared' } })
    await expect(getCvSharedLinks('cv_1')).resolves.toEqual([{ public_id: 'cvs_1' }])
    await expect(createCvSharedLink('cv_1', { version_public_id: 'cvv_2' })).resolves.toEqual({ link: { public_id: 'cvs_1' }, token: 'raw-token-once' })
    await expect(revokeCvSharedLink('cv_1', 'cvs_1')).resolves.toBeUndefined()

    expect(get).toHaveBeenNthCalledWith(1, '/v2/cvs/cv_1/view/')
    expect(get).toHaveBeenNthCalledWith(2, '/v2/cvs/shares/token%2Fwith-space/')
    expect(get).toHaveBeenNthCalledWith(3, '/v2/cvs/cv_1/shared-links/')
    expect(post).toHaveBeenCalledWith('/v2/cvs/cv_1/shared-links/', { version_public_id: 'cvv_2' })
    expect(remove).toHaveBeenCalledWith('/v2/cvs/cv_1/shared-links/cvs_1/')
  })

  it('uses owner-scoped immutable PDF export jobs and a controlled download endpoint', async () => {
    get.mockResolvedValueOnce({ data: { results: [{ public_id: 'cvv_2', version_number: 2 }] } })
    post.mockResolvedValueOnce({ data: { public_id: 'cve_1', status: 'pending', version_public_id: 'cvv_2' } })
    get.mockResolvedValueOnce({ data: { public_id: 'cve_1', status: 'completed', download_url: '/api/v2/cvs/cv_1/exports/cve_1/download/' } })
    post.mockResolvedValueOnce({ data: { public_id: 'cve_1', status: 'pending' } })
    get.mockResolvedValueOnce({ data: new Blob(['%PDF-1.4']) })

    await expect(getCvVersions('cv_1')).resolves.toEqual([{ public_id: 'cvv_2', version_number: 2 }])
    await expect(createCvPdfExport('cv_1', 'cvv_2')).resolves.toMatchObject({ status: 'pending' })
    await expect(getCvPdfExport('cv_1', 'cve_1')).resolves.toMatchObject({ status: 'completed' })
    await expect(retryCvPdfExport('cv_1', 'cve_1')).resolves.toMatchObject({ status: 'pending' })
    await expect(downloadCvPdf('/api/v2/cvs/cv_1/exports/cve_1/download/')).resolves.toBeInstanceOf(Blob)

    expect(get).toHaveBeenNthCalledWith(1, '/v2/cvs/cv_1/versions/')
    expect(post).toHaveBeenNthCalledWith(1, '/v2/cvs/cv_1/exports/', { version_public_id: 'cvv_2' })
    expect(get).toHaveBeenNthCalledWith(2, '/v2/cvs/cv_1/exports/cve_1/')
    expect(post).toHaveBeenNthCalledWith(2, '/v2/cvs/cv_1/exports/cve_1/retry/', {})
    expect(get).toHaveBeenNthCalledWith(3, '/api/v2/cvs/cv_1/exports/cve_1/download/', { responseType: 'blob' })
  })
})
