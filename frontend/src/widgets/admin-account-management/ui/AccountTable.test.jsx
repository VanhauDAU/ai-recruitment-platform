import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountTable from './AccountTable'

describe('AccountTable', () => {
  it('renders the date fallback instead of returning the row as legacy cell props', () => {
    render(
      <AccountTable
        data={{
          count: 1,
          results: [{
            public_id: 'usr_recruiter',
            email: 'recruiter@example.com',
            full_name: 'Nhà tuyển dụng',
            role: 'employer',
            status: 'active',
            date_joined: null,
            last_activity_at: null,
            context: {},
          }],
        }}
        loading={false}
        page={1}
        ordering="-date_joined"
        recruiterOnly
        onPageChange={vi.fn()}
        onOrderingChange={vi.fn()}
        onQuickView={vi.fn()}
        onOpenDetail={vi.fn()}
        onEdit={vi.fn()}
        onSecurity={vi.fn()}
        canEdit={() => false}
        canManageSecurity={() => false}
        resultLabel="nhà tuyển dụng"
      />,
    )

    expect(screen.getAllByText('Chưa có')).toHaveLength(2)
  })
})
