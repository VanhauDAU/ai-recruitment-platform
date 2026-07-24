import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changeCampaignStatus,
  createCampaign,
  getCampaign,
  getCampaignActivities,
  getCampaignJobPerformance,
  getCampaignOptions,
  getCampaignPauseImpact,
  getCampaignReport,
  getCampaigns,
  updateCampaign,
} from './campaign.api'
import { campaignKeys } from './campaign.keys'

const { get, patch, post } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: { get, patch, post } }))

describe('campaign API', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    post.mockReset()
  })

  it('uses recruiter-owned campaign endpoints and normalizes paginated lists', async () => {
    get
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'camp_1' }] } })
      .mockResolvedValueOnce({ data: { public_id: 'camp_1' } })
      .mockResolvedValueOnce({ data: { results: [{ public_id: 'camp_1' }] } })
      .mockResolvedValueOnce({ data: { funnel: {} } })
      .mockResolvedValueOnce({ data: { range: { days: 30 } } })
      .mockResolvedValueOnce({ data: { active_public_job_count: 1 } })
      .mockResolvedValueOnce({ data: { count: 1, results: [{ id: 1 }] } })
    post
      .mockResolvedValueOnce({ data: { public_id: 'camp_1' } })
      .mockResolvedValueOnce({ data: { public_id: 'camp_1', status: 'active' } })
    patch.mockResolvedValue({ data: { public_id: 'camp_1', name: 'Đã sửa' } })

    await expect(getCampaigns({ status: 'draft' })).resolves.toEqual({
      results: [{ public_id: 'camp_1' }],
    })
    await expect(getCampaign('camp_1')).resolves.toEqual({ public_id: 'camp_1' })
    await expect(createCampaign({ name: 'Mới' })).resolves.toEqual({ public_id: 'camp_1' })
    await expect(updateCampaign('camp_1', { name: 'Đã sửa' })).resolves.toMatchObject({ name: 'Đã sửa' })
    await expect(changeCampaignStatus('camp_1', 'active')).resolves.toMatchObject({ status: 'active' })
    await expect(getCampaignOptions()).resolves.toEqual([{ public_id: 'camp_1' }])
    await expect(getCampaignReport('camp_1')).resolves.toEqual({ funnel: {} })
    await expect(getCampaignJobPerformance('camp_1', 30)).resolves.toEqual({ range: { days: 30 } })
    await expect(getCampaignPauseImpact('camp_1')).resolves.toEqual({
      active_public_job_count: 1,
    })
    await expect(getCampaignActivities('camp_1', { page: 2 })).resolves.toEqual({
      count: 1,
      results: [{ id: 1 }],
    })

    expect(get).toHaveBeenNthCalledWith(1, '/employer/campaigns/', { params: { status: 'draft' } })
    expect(get).toHaveBeenNthCalledWith(2, '/employer/campaigns/camp_1/')
    expect(post).toHaveBeenNthCalledWith(1, '/employer/campaigns/', { name: 'Mới' })
    expect(patch).toHaveBeenCalledWith('/employer/campaigns/camp_1/', { name: 'Đã sửa' })
    expect(post).toHaveBeenNthCalledWith(2, '/employer/campaigns/camp_1/status/', { status: 'active' })
    expect(get).toHaveBeenNthCalledWith(3, '/employer/campaigns/options/')
    expect(get).toHaveBeenNthCalledWith(4, '/employer/campaigns/camp_1/report/')
    expect(get).toHaveBeenNthCalledWith(5, '/employer/campaigns/camp_1/job-performance/', { params: { days: 30 } })
    expect(get).toHaveBeenNthCalledWith(6, '/employer/campaigns/camp_1/pause-impact/')
    expect(get).toHaveBeenNthCalledWith(7, '/employer/campaigns/camp_1/activities/', {
      params: { page: 2 },
    })
  })

  it('builds stable cache keys for campaign lists and details', () => {
    expect(campaignKeys.list({ status: 'active' })).toEqual([
      'campaigns',
      'list',
      { status: 'active' },
    ])
    expect(campaignKeys.detail('camp_1')).toEqual(['campaigns', 'detail', 'camp_1'])
    expect(campaignKeys.report('camp_1')).toEqual(['campaigns', 'report', 'camp_1'])
    expect(campaignKeys.pauseImpact('camp_1')).toEqual([
      'campaigns',
      'pause-impact',
      'camp_1',
    ])
    expect(campaignKeys.jobPerformance('camp_1', 7)).toEqual(['campaigns', 'job-performance', 'camp_1', 7])
  })
})
