import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createConsultationLead,
  exportAdminConsultationLeads,
  getAdminConsultationLeads,
  updateAdminConsultationLead,
} from './consultation-lead.api'
import { consultationLeadKeys } from './consultation-lead.keys'

const { get, patch, post } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('consultation lead API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('forwards admin filters, pagination and the query cancellation signal', async () => {
    const controller = new AbortController()
    const response = { count: 1, results: [{ id: 7 }] }
    get.mockResolvedValue({ data: response })

    await expect(
      getAdminConsultationLeads(
        { status: 'new', page: 2 },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(response)

    expect(get).toHaveBeenCalledWith('/services/admin/consultations/', {
      params: { status: 'new', page: 2 },
      signal: controller.signal,
    })
  })

  it('keeps create/update endpoints and canonical admin list keys stable', async () => {
    post.mockResolvedValue({ data: { id: 8 } })
    patch.mockResolvedValue({ data: { id: 8, status: 'contacted' } })

    await expect(createConsultationLead({ full_name: 'Nguyễn An' })).resolves.toEqual({ id: 8 })
    await expect(
      updateAdminConsultationLead(8, { status: 'contacted' }),
    ).resolves.toMatchObject({ status: 'contacted' })

    expect(consultationLeadKeys.adminList({
      status: 'new',
      q: 'alpha',
      ordering: '-email',
      page: 2,
    })).toEqual([
      ...consultationLeadKeys.adminLists,
      { status: 'new', q: 'alpha', ordering: '-email', page: 2 },
    ])
    expect(post).toHaveBeenCalledWith('/services/consultations/', {
      full_name: 'Nguyễn An',
    })
    expect(patch).toHaveBeenCalledWith(
      '/services/admin/consultations/8/',
      { status: 'contacted' },
    )
  })

  it('downloads the filtered admin CSV and exposes export metadata', async () => {
    const controller = new AbortController()
    const blob = new Blob(['\ufeffID,Khách hàng'])
    get.mockResolvedValue({
      data: blob,
      headers: {
        'content-disposition': 'attachment; filename="consultation-leads-2026-08-10.csv"',
        'x-export-row-limit': '10000',
        'x-export-truncated': 'true',
      },
    })

    await expect(exportAdminConsultationLeads(
      {
        status: 'new',
        q: 'alpha',
        created_from: '2026-08-01',
        created_to: '2026-08-10',
        ordering: '-created_at',
      },
      { signal: controller.signal },
    )).resolves.toEqual({
      blob,
      filename: 'consultation-leads-2026-08-10.csv',
      rowLimit: 10000,
      truncated: true,
    })

    expect(get).toHaveBeenCalledWith('/services/admin/consultations/export/', {
      params: {
        status: 'new',
        q: 'alpha',
        created_from: '2026-08-01',
        created_to: '2026-08-10',
        ordering: '-created_at',
      },
      responseType: 'blob',
      signal: controller.signal,
    })
  })
})
