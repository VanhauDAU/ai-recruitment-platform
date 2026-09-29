import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import JobListHeader from './JobListHeader'

function renderHeader(canCreateJobAlert) {
  return render(
    <MemoryRouter>
      <JobListHeader
        canCreateJobAlert={canCreateJobAlert}
        catChain={[]}
        count={0}
        loading={false}
        updateLabel=""
      />
    </MemoryRouter>,
  )
}

describe('JobListHeader candidate alert CTA', () => {
  it('shows the alert action for candidate-capable sessions', () => {
    renderHeader(true)
    expect(screen.getByRole('button', { name: 'Tạo thông báo việc làm' })).toBeInTheDocument()
  })

  it('hides the candidate-only alert action from employer and admin sessions', () => {
    renderHeader(false)
    expect(screen.queryByRole('button', { name: 'Tạo thông báo việc làm' })).not.toBeInTheDocument()
  })
})

