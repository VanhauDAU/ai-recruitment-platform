import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import JobFormProgress from './JobFormProgress'

const viewport = vi.hoisted(() => ({ compact: false }))
vi.mock('@/shared/hooks/use-media-query', () => ({ useMediaQuery: () => viewport.compact }))

const sections = [
  {
    key: 'general',
    label: 'Thông tin chung',
    completed: 2,
    total: 2,
    items: [
      { label: 'Tiêu đề tin', done: true },
      { label: 'Vị trí chuyên môn', done: true },
    ],
  },
  {
    key: 'description',
    label: 'Mô tả công việc',
    completed: 0,
    total: 1,
    items: [{ label: 'Yêu cầu ứng viên', done: false }],
  },
]

describe('JobFormProgress', () => {
  it('only renders child items for sections that are open in the form', () => {
    render(
      <JobFormProgress
        sections={sections}
        activeSection="description"
        openSections={new Set(['description'])}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByText('Tiêu đề tin')).not.toBeInTheDocument()
    expect(screen.getByText('Yêu cầu ứng viên')).toBeInTheDocument()
  })

  it('shows a compact step strip below xl and jumps to the chosen section', () => {
    viewport.compact = true
    const onSelect = vi.fn()
    render(
      <JobFormProgress
        sections={sections}
        activeSection="general"
        openSections={new Set(['general'])}
        onSelect={onSelect}
      />,
    )

    expect(screen.queryByText('Tiêu đề tin')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thông tin chung 2/2' })).toHaveAttribute('aria-current', 'step')
    screen.getByRole('button', { name: 'Mô tả công việc 0/1' }).click()
    expect(onSelect).toHaveBeenCalledWith('description')
    viewport.compact = false
  })

  it('keeps the completed marker when a completed section is closed', () => {
    const { container } = render(
      <JobFormProgress
        sections={sections}
        activeSection="general"
        openSections={new Set()}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Thông tin chung/ })).toHaveAttribute('aria-current', 'step')
    expect(container.querySelector('.anticon-check')).toBeInTheDocument()
  })
})
