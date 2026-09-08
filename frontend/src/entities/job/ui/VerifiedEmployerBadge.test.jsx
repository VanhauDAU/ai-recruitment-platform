import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { describe, expect, it } from 'vitest'
import VerifiedEmployerBadge from './VerifiedEmployerBadge'

const CRITERIA = [
  { key: 'email_domain_verified', label: 'Đã xác thực email tên miền công ty', passed: true },
  { key: 'phone_verified', label: 'Đã xác thực số điện thoại', passed: true },
  { key: 'business_doc_approved', label: 'Hồ sơ pháp lý/quyền đại diện đã được duyệt', passed: true },
  { key: 'account_age_reached', label: 'Tài khoản NTD được tạo tối thiểu 6 tháng', passed: true },
  { key: 'no_report_history', label: 'Chưa có tin đăng vi phạm được quản trị viên xác nhận', passed: true },
]

function renderBadge(props) {
  return render(<App><VerifiedEmployerBadge {...props} /></App>)
}

describe('VerifiedEmployerBadge', () => {
  it('shows the backend-owned criteria on detail surfaces', async () => {
    renderBadge({ verification: { verified: true, criteria: CRITERIA }, showCriteria: true })

    await userEvent.hover(screen.getByLabelText('Nhà tuyển dụng đã xác thực, xem 5 tiêu chí'))

    for (const criterion of CRITERIA) {
      expect(await screen.findByText(criterion.label)).toBeInTheDocument()
    }
  })

  it('derives accessible criteria count instead of hard-coding five', async () => {
    renderBadge({
      verification: { verified: true, criteria: CRITERIA.slice(0, 3) },
      showCriteria: true,
    })

    await userEvent.tab()
    expect(screen.getByLabelText('Nhà tuyển dụng đã xác thực, xem 3 tiêu chí')).toHaveFocus()
  })

  it('uses only the boolean contract on list surfaces', () => {
    renderBadge({ verified: true })

    expect(screen.getByLabelText('Nhà tuyển dụng đã xác thực')).toBeInTheDocument()
    expect(screen.queryByText(CRITERIA[0].label)).not.toBeInTheDocument()
  })

  it('renders a compact text label when requested', () => {
    renderBadge({ verified: true, appearance: 'label' })

    expect(screen.getByText('NTD đã xác thực')).toBeInTheDocument()
  })

  it('renders nothing for an unverified employer even if failed criteria exist', () => {
    const { container } = renderBadge({
      verification: { verified: false, criteria: [{ ...CRITERIA[0], passed: false }] },
      showCriteria: true,
    })

    expect(container.querySelector('.anticon')).toBeNull()
  })
})
