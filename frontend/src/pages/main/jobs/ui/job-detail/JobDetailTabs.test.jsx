import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import JobDetailTabs from './JobDetailTabs'

function Harness() {
  const [active, setActive] = useState('info')
  return (
    <JobDetailTabs
      active={active}
      onChange={setActive}
      relatedCount={3}
      panels={{ info: <p>Chi tiết tin</p>, company: <p>Thẻ công ty</p>, related: <p>Danh sách việc</p> }}
    />
  )
}

describe('JobDetailTabs', () => {
  it('switches panels by click and arrow keys, keeping hidden panels mounted', () => {
    render(<Harness />)

    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Việc liên quan 3' })).toBeVisible()
    expect(screen.getByText('Chi tiết tin')).toBeVisible()
    expect(screen.getByText('Thẻ công ty')).not.toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: 'Công ty' }))
    expect(screen.getByText('Thẻ công ty')).toBeVisible()
    expect(screen.getByText('Chi tiết tin')).not.toBeVisible()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Công ty' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Việc liên quan 3' })).toHaveFocus()
    expect(screen.getByText('Danh sách việc')).toBeVisible()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Việc liên quan 3' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
  })
})
