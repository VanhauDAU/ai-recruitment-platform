import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SearchDropdown from './SearchDropdown'

const mocks = vi.hoisted(() => ({
  getJobs: vi.fn(),
  getJobSuggestions: vi.fn(),
}))

vi.mock('@/entities/job', () => ({
  companyInitial: (name) => name?.slice(0, 1),
  formatNumber: (value) => String(value),
  formatSalary: () => 'Thỏa thuận',
  getJobs: mocks.getJobs,
  getJobSuggestions: mocks.getJobSuggestions,
  jobDetailPath: (job) => `/viec-lam/${job.public_id}`,
}))

vi.mock('@/shared/hooks/use-debounced-value', () => ({ default: (value) => value }))

function renderDropdown(props = {}) {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)
  wrapper.getBoundingClientRect = () => ({ left: 10, top: 20, bottom: 40, width: 320 })
  const wrapperRef = { current: wrapper }
  const result = render(
    <BrowserRouter>
      <SearchDropdown open onClose={vi.fn()} onSelect={vi.fn()} wrapperRef={wrapperRef} {...props} />
    </BrowserRouter>,
  )
  return { ...result, wrapper }
}

describe('SearchDropdown', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.getJobs.mockReset()
    mocks.getJobSuggestions.mockReset()
    mocks.getJobs.mockResolvedValue([])
    mocks.getJobSuggestions.mockResolvedValue([])
  })

  afterEach(() => {
    document.querySelectorAll('[data-search-anchor]').forEach((element) => element.remove())
    vi.restoreAllMocks()
  })

  it('shows history and can remove one entry or clear all entries', async () => {
    localStorage.setItem('search_history', JSON.stringify([
      { q: 'React', by: 'title', count: 2 },
      { q: 'Vue', by: 'company', count: null },
    ]))
    renderDropdown()

    await screen.findByRole('button', { name: /React/ })
    const reactButton = screen.getByRole('button', { name: /React/ })
    fireEvent.click(reactButton.querySelector('[role="button"]'))
    expect(screen.queryByRole('button', { name: /React/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xóa tất cả' }))
    expect(localStorage.getItem('search_history')).toBeNull()
    expect(screen.queryByRole('button', { name: /Vue/ })).not.toBeInTheDocument()
  })

  it('selects a keyword suggestion', async () => {
    const onSelect = vi.fn()
    mocks.getJobSuggestions.mockResolvedValue(['React developer'])
    renderDropdown({ keyword: 'react', onSelect })

    fireEvent.click((await screen.findByText('React')).closest('button'))

    expect(onSelect).toHaveBeenCalledWith('React developer', 'title')
  })

  it('shows keyword suggestions above search history and caps the dropdown height', async () => {
    localStorage.setItem('search_history', JSON.stringify([{ q: 'React', by: 'title', count: 2 }]))
    mocks.getJobSuggestions.mockResolvedValue(['React developer'])
    renderDropdown({ keyword: 'react' })

    const suggestionsHeading = await screen.findByText('Từ khóa gợi ý')
    const historyHeading = screen.getByText('Từ khóa tìm kiếm gần đây')
    expect(suggestionsHeading.compareDocumentPosition(historyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByTestId('search-dropdown')).toHaveClass('max-h-[min(32rem,calc(100dvh-1.5rem))]', 'overflow-y-auto')
  })

  it('does not request keyword suggestions for a short keyword', async () => {
    renderDropdown({ keyword: 'r' })

    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalled())
    expect(mocks.getJobSuggestions).not.toHaveBeenCalled()
  })

  it('ignores a stale keyword suggestion response', async () => {
    let resolveFirst
    const first = new Promise((resolve) => { resolveFirst = resolve })
    mocks.getJobSuggestions
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(['Vue developer'])
    const view = renderDropdown({ keyword: 'react' })

    view.rerender(
      <BrowserRouter>
        <SearchDropdown open keyword="vue" onClose={vi.fn()} onSelect={vi.fn()} wrapperRef={{ current: view.wrapper }} />
      </BrowserRouter>,
    )
    resolveFirst(['React developer'])

    expect(await screen.findByText('Vue')).toBeInTheDocument()
    expect(screen.queryByText('React')).not.toBeInTheDocument()
  })

  it('closes when the user clicks outside the anchor and dropdown', async () => {
    const onClose = vi.fn()
    renderDropdown({ onClose })

    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalled())
    fireEvent.mouseDown(document.body)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cleans up window and document listeners when closed', async () => {
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener')
    const view = renderDropdown()

    await waitFor(() => expect(mocks.getJobs).toHaveBeenCalled())
    view.unmount()

    expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeWindowListener).toHaveBeenCalledWith('scroll', expect.any(Function), true)
    expect(removeDocumentListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })
})
