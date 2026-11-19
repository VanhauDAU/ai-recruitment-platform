import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JobFitResult from './JobFitResult'
import { RESULT } from './fixtures'

describe('JobFitResult', () => {
  it('shows the verdict on the band scale with the disclaimer', () => {
    render(<JobFitResult result={RESULT} />)
    expect(screen.getByText('Phù hợp', { selector: '#jf-verdict-title' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '72 điểm, mức Phù hợp' })).toBeInTheDocument()
    expect(screen.getByText(/không phải quyết định tuyển dụng/)).toBeInTheDocument()
  })

  it('shows evidence quotes and marks skills that are only listed', () => {
    render(<JobFitResult result={RESULT} />)
    expect(screen.getByText('Xây dựng trang thanh toán bằng ReactJS.')).toBeInTheDocument()
    const jest = screen.getByText('Jest').closest('li')
    expect(within(jest).getByText('chỉ liệt kê')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('names criteria without data instead of scoring them', () => {
    render(<JobFitResult result={RESULT} />)
    expect(screen.getByText('Chưa đủ dữ liệu')).toBeInTheDocument()
    expect(screen.getByText('Tin không yêu cầu')).toBeInTheDocument()
    expect(screen.getByText('Yêu cầu của tin: CV nói tới 1/2')).toBeInTheDocument()
  })
})
