import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import VerificationDocumentBoard from './VerificationDocumentBoard'

const documents = [
  {
    public_id: 'doc_pending',
    doc_type_label: 'Giấy phép kinh doanh',
    file_name: 'business.pdf',
    version: 2,
    status: 'pending',
    created_at: '2026-08-10T08:00:00Z',
    duplicate_company_count: 0,
  },
  {
    public_id: 'doc_approved',
    doc_type_label: 'Giấy ủy quyền',
    file_name: 'authorization.pdf',
    version: 1,
    status: 'approved',
    created_at: '2026-08-09T08:00:00Z',
    duplicate_company_count: 0,
  },
]

describe('VerificationDocumentBoard', () => {
  it('selects a document for preview without changing its status', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onDecision = vi.fn()
    render(
      <VerificationDocumentBoard
        documents={documents}
        selectedDocumentId="doc_approved"
        canReview
        onSelect={onSelect}
        onDecision={onDecision}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Xem Giấy phép kinh doanh' }))

    expect(onSelect).toHaveBeenCalledWith('doc_pending')
    expect(onDecision).not.toHaveBeenCalled()
  })

  it('offers an accessible menu fallback and asks the parent to confirm a transition', async () => {
    const user = userEvent.setup()
    const onDecision = vi.fn()
    render(
      <VerificationDocumentBoard
        documents={documents}
        selectedDocumentId="doc_pending"
        canReview
        onSelect={vi.fn()}
        onDecision={onDecision}
      />,
    )

    await user.click(screen.getByRole('button', {
      name: 'Đổi trạng thái Giấy phép kinh doanh',
    }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByText('Đã duyệt'))

    expect(onDecision).toHaveBeenCalledWith(documents[0], 'approved')
  })

  it('does not expose status controls to a view-only actor', () => {
    render(
      <VerificationDocumentBoard
        documents={documents}
        selectedDocumentId="doc_pending"
        canReview={false}
        onSelect={vi.fn()}
        onDecision={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', {
      name: 'Đổi trạng thái Giấy phép kinh doanh',
    })).not.toBeInTheDocument()
  })
})
