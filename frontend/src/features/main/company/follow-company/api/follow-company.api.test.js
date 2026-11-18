import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  followCompany,
  getCompanyFollow,
  getFollowedCompanies,
  unfollowCompany,
} from './follow-company.api'
import { followCompanyKeys } from './follow-company.keys'

const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }))

vi.mock('@/shared/api/client', () => ({ default: client }))

const STATUS = { following: true, notify_new_jobs: true, follower_count: 13 }

describe('follow company API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.get.mockResolvedValue({ data: STATUS })
    client.put.mockResolvedValue({ data: STATUS })
    client.delete.mockResolvedValue({ data: { following: false, notify_new_jobs: false, follower_count: 12 } })
  })

  it('reads, sets and clears the follow of one company by public id', async () => {
    const signal = new AbortController().signal

    await expect(getCompanyFollow('co_ab12', { signal })).resolves.toEqual(STATUS)
    await expect(followCompany('co_ab12')).resolves.toEqual(STATUS)
    await followCompany('co_ab12', { notify_new_jobs: false })
    await expect(unfollowCompany('co_ab12')).resolves.toMatchObject({ following: false, follower_count: 12 })

    expect(client.get).toHaveBeenCalledWith('/companies/co_ab12/follow/', { signal })
    expect(client.put).toHaveBeenNthCalledWith(1, '/companies/co_ab12/follow/', {})
    expect(client.put).toHaveBeenNthCalledWith(2, '/companies/co_ab12/follow/', { notify_new_jobs: false })
    expect(client.delete).toHaveBeenCalledWith('/companies/co_ab12/follow/')
  })

  it('pages the followed companies of the signed-in candidate', async () => {
    const signal = new AbortController().signal
    client.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } })

    await expect(getFollowedCompanies({ page: 2, page_size: 10 }, { signal })).resolves.toMatchObject({ count: 0 })

    expect(client.get).toHaveBeenCalledWith('/candidate/followed-companies/', {
      params: { page: 2, page_size: 10 },
      signal,
    })
    expect(followCompanyKeys.followedList(2).slice(0, 2)).toEqual(followCompanyKeys.followedLists)
  })
})
