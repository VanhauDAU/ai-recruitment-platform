import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TaxLookupEvidenceCard from './TaxLookupEvidenceCard'

describe('TaxLookupEvidenceCard', () => {
  it('shows submitted and VietQR values without mutating either source', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(
      <TaxLookupEvidenceCard
        canRefresh
        recruiterCompanyRole="member"
        onRefresh={onRefresh}
        evidence={{
          status: 'found',
          workflow_revision: 2,
          tax_code: '0316794479',
          returned_tax_code: '0316794479',
          submitted_company_name: 'Công ty Casso',
          registered_name: 'CÔNG TY TNHH CASSO',
          comparison: {
            tax_code: 'match',
            company_name: 'mismatch',
          },
          completed_at: '2026-07-27T00:00:00Z',
        }}
      />,
    )

    expect(screen.getByText('Cần đối chiếu thủ công')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xem dữ liệu đối chiếu/ }))
    expect(screen.getAllByText('0316794479')).toHaveLength(2)
    expect(screen.getByText('Công ty Casso')).toBeInTheDocument()
    expect(screen.getByText('CÔNG TY TNHH CASSO')).toBeInTheDocument()
    expect(screen.getByText('Khác dữ liệu')).toBeInTheDocument()
    expect(screen.getByText(/là thành viên của công ty/)).toBeInTheDocument()
    expect(screen.getByText(/không có nghĩa người này đã tạo hoặc chỉnh sửa công ty/)).toBeInTheDocument()
    expect(screen.queryByText('Địa chỉ đăng ký')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tra cứu lại/ }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('keeps manual review available when no evidence exists', () => {
    render(<TaxLookupEvidenceCard />)

    expect(screen.getByText('Cần đối chiếu thủ công')).toBeInTheDocument()
    expect(screen.getByText(/kiểm tra giấy tờ pháp lý trước khi duyệt/)).toBeInTheDocument()
  })
})
