import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JobFitResult from './JobFitResult'
import { RESULT } from '../tests/job-fit-fixtures'

describe('JobFitResult', () => {
  it('shows the verdict on the band scale with the disclaimer', () => {
    render(<JobFitResult result={RESULT} />)
    expect(screen.getByText('Phù hợp', { selector: '#jf-verdict-title' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '72 điểm, mức Phù hợp' })).toBeInTheDocument()
    expect(screen.getByText(/không phải quyết định tuyển dụng/)).toBeInTheDocument()
  })

  it('names the model that scored the CV and keeps the action in the footer', () => {
    render(<JobFitResult result={{ ...RESULT, meta: { model_version: 'e5-base-wise-v1', reranker_version: 'req-ce-v1' } }} actions={<button type="button">Ứng tuyển tin này</button>} />)
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByText('Mô hình AI: e5-base-wise-v1 + req-ce-v1')).toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: 'Ứng tuyển tin này' })).toBeInTheDocument()
  })

  it('splits the details into tabs with counts and moves between them with the arrow keys', () => {
    render(<JobFitResult result={RESULT} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Tổng quan', 'Kỹ năng2/3', 'Yêu cầu1/2', 'Gợi ý1'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: /Kỹ năng/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Còn thiếu (1)')
    fireEvent.click(screen.getByRole('tab', { name: 'Tổng quan' }))
    expect(screen.getByText('Nên làm trước')).toBeInTheDocument()
  })

  it('shows evidence quotes and marks skills that are only listed', () => {
    render(<JobFitResult result={RESULT} />)
    fireEvent.click(screen.getByRole('tab', { name: /Kỹ năng/ }))
    expect(screen.getByText('Xây dựng trang thanh toán bằng ReactJS.')).toBeInTheDocument()
    const jest = screen.getByText('Jest').closest('li')
    expect(within(jest).getByText('chỉ liệt kê')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('names criteria without data instead of scoring them', () => {
    render(<JobFitResult result={RESULT} />)
    expect(screen.getByText('Chưa đủ dữ liệu')).toBeInTheDocument()
    expect(screen.getByText('Tin không yêu cầu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Yêu cầu/ }))
    expect(screen.getByText('Yêu cầu của tin: CV nói tới 1/2')).toBeInTheDocument()
  })
})
