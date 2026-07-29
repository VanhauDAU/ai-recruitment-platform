import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnnouncementTable from './AnnouncementTable'

describe('AnnouncementTable', () => {
  it('makes every data column server-sortable and keeps actions exempt', () => {
    render(
      <AnnouncementTable
        data={{ count: 0, results: [] }}
        loading={false}
        ordering="-updated_at"
        page={1}
        onChange={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(7)
    expect(headers.slice(0, 6).every(
      (header) => header.classList.contains('ant-table-column-has-sorters'),
    )).toBe(true)
    expect(screen.getByRole('columnheader', { name: 'Thao tác' }))
      .not.toHaveClass('ant-table-column-has-sorters')
  })
})
