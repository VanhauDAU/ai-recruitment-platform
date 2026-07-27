import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedJobs from './SavedJobs'

const mocks = vi.hoisted(() => ({
  reloadSaved: vi.fn(),
  reloadRecommendations: vi.fn(),
  session: {
    loading: false,
    isAuthenticated: true,
  },
  savedJobs: {
    items: [],
    loading: false,
    refreshing: false,
    isCandidate: true,
    loadError: null,
    toggleError: null,
  },
  recommendations: {
    jobs: [],
    sourceSavedJobCount: 0,
    strategy: 'recent-active-fallback-v1',
    loading: false,
    error: null,
  },
}))

vi.mock('@/entities/session', () => ({
  useSession: () => mocks.session,
}))

vi.mock('@/features/saved-jobs', () => ({
  useSavedJobs: () => ({
    ...mocks.savedJobs,
    reload: mocks.reloadSaved,
  }),
  useSavedJobRecommendations: () => ({
    ...mocks.recommendations,
    reload: mocks.reloadRecommendations,
  }),
}))

vi.mock('./ui/JobCard', () => ({
  default: ({ job, savedAt }) => (
    <article>
      {job.title}
      {savedAt && <span>Đã lưu {savedAt}</span>}
    </article>
  ),
}))

vi.mock('./ui/JobCardSkeleton', () => ({
  default: () => <div>Đang tải việc làm</div>,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedJobs />
    </MemoryRouter>,
  )
}

describe('SavedJobs', () => {
  beforeEach(() => {
    mocks.reloadSaved.mockReset()
    mocks.reloadRecommendations.mockReset()
    Object.assign(mocks.session, {
      loading: false,
      isAuthenticated: true,
    })
    Object.assign(mocks.savedJobs, {
      items: [],
      loading: false,
      refreshing: false,
      isCandidate: true,
      loadError: null,
      toggleError: null,
    })
    Object.assign(mocks.recommendations, {
      jobs: [],
      sourceSavedJobCount: 0,
      strategy: 'recent-active-fallback-v1',
      loading: false,
      error: null,
    })
  })

  it('keeps useful job suggestions visible when the saved list is empty', () => {
    mocks.recommendations.jobs = [{
      public_id: 'job-2',
      title: 'Backend Developer',
    }]

    renderPage()

    expect(screen.getByText('Bạn chưa lưu việc làm nào')).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: 'Việc làm bạn có thể quan tâm',
    })).toBeInTheDocument()
    expect(screen.getByText('Backend Developer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Khám phá việc làm/ })).toHaveAttribute(
      'href',
      '/viec-lam',
    )
  })

  it('shows saved timestamps and labels history-based recommendations', () => {
    mocks.savedJobs.items = [{
      created_at: '2026-07-24T01:32:00+07:00',
      job_detail: {
        public_id: 'job-1',
        title: 'Python Developer',
      },
    }]
    Object.assign(mocks.recommendations, {
      jobs: [{ public_id: 'job-3', title: 'Django Developer' }],
      sourceSavedJobCount: 1,
      strategy: 'saved-job-similarity-v1',
    })

    renderPage()

    expect(screen.getByRole('heading', {
      name: 'Danh sách 1 việc làm đã lưu',
    })).toBeInTheDocument()
    expect(screen.getByText('Đã lưu 2026-07-24T01:32:00+07:00')).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: 'Việc làm tương tự việc bạn đã lưu',
    })).toBeInTheDocument()
    expect(screen.getByText('Django Developer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tạo CV ngay' })).toHaveAttribute(
      'href',
      '/mau-cv',
    )
  })

  it('distinguishes a saved-list failure from a true empty state and retries', async () => {
    const user = userEvent.setup()
    mocks.savedJobs.loadError = {
      response: { status: 503, data: {} },
    }

    renderPage()

    expect(screen.getByText('Chưa tải được việc làm đã lưu')).toBeInTheDocument()
    expect(screen.queryByText('Bạn chưa lưu việc làm nào')).not.toBeInTheDocument()
    expect(screen.getByText('Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.'))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Thử lại/ }))
    expect(mocks.reloadSaved).toHaveBeenCalledTimes(1)
  })
})
