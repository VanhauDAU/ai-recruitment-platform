import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AdminJobChangeReview from './AdminJobChangeReview'

function renderReview(pendingChanges) {
  return render(
    <AdminJobChangeReview
      job={{ pending_changes: pendingChanges }}
      onToggle={vi.fn()}
      openSection="changes"
    />,
  )
}

describe('AdminJobChangeReview', () => {
  it('shows both sides of every field the employer edited', () => {
    renderReview({
      has_baseline: true,
      baseline_captured_at: '2026-08-01T03:00:00Z',
      changed_count: 2,
      hidden_sensitive_count: 0,
      changes: [
        {
          key: 'title',
          label: 'Tiêu đề tin',
          kind: 'text',
          sensitive: false,
          before: 'Backend Engineer',
          after: 'Senior Backend Engineer',
        },
        {
          key: 'skills',
          label: 'Kỹ năng',
          kind: 'list',
          sensitive: false,
          before: ['Python'],
          after: ['Python', 'Go'],
        },
      ],
    })

    expect(screen.getByText('Backend Engineer')).toBeVisible()
    expect(screen.getByText('Senior Backend Engineer')).toBeVisible()
    expect(screen.getByText('Go')).toBeVisible()
    expect(screen.getAllByText('Bản đã duyệt')).toHaveLength(2)
    expect(screen.getAllByText('Bản gửi duyệt')).toHaveLength(2)
  })

  it('states that restricted contact edits exist without revealing them', () => {
    renderReview({
      has_baseline: true,
      baseline_captured_at: '2026-08-01T03:00:00Z',
      changed_count: 1,
      hidden_sensitive_count: 1,
      changes: [],
    })

    expect(screen.getByText(/1 thay đổi thuộc thông tin/)).toBeVisible()
  })

  it('says a baseline is missing instead of implying nothing changed', () => {
    renderReview({
      has_baseline: false,
      baseline_captured_at: null,
      changed_count: 0,
      hidden_sensitive_count: 0,
      changes: [],
    })

    expect(screen.getByText('Chưa có bản đã duyệt để so sánh')).toBeVisible()
    expect(screen.queryByText('Bản gửi duyệt')).not.toBeInTheDocument()
  })
})
