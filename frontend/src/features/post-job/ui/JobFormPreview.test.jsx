import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import JobFormPreview from './JobFormPreview'

describe('JobFormPreview', () => {
  it('switches between the two preview pages with radio buttons', async () => {
    const user = userEvent.setup()
    render(<JobFormPreview values={{ title: 'Backend Engineer' }} />)

    const jobListRadio = screen.getByRole('radio', { name: 'Danh sách việc làm' })
    const jobDetailRadio = screen.getByRole('radio', { name: 'Chi tiết tin tuyển dụng' })

    expect(jobListRadio).toBeChecked()
    expect(jobDetailRadio).not.toBeChecked()
    expect(screen.queryByRole('heading', { name: 'Chi tiết tin tuyển dụng' })).not.toBeInTheDocument()

    await user.click(jobDetailRadio.closest('label'))

    expect(jobDetailRadio).toBeChecked()
    expect(jobListRadio).not.toBeChecked()
    expect(screen.getByRole('heading', { name: 'Chi tiết tin tuyển dụng' })).toBeInTheDocument()
  })
})
