import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { describe, expect, it } from 'vitest'
import VerifiedEmployerBadge from './VerifiedEmployerBadge'

const CRITERIA = [
  { key: 'email_domain_verified', label: 'Đã xác thực email tên miền công ty', passed: true },
  { key: 'phone_verified', label: 'Đã xác thực số điện thoại', passed: true },
  { key: 'business_doc_approved', label: 'Đã được duyệt Giấy phép kinh doanh', passed: true },
  { key: 'account_age_reached', label: 'Tài khoản NTD được tạo tối thiểu 6 tháng', passed: true },
  { key: 'no_report_history', label: 'Chưa có tin đăng vi phạm được quản trị viên xác nhận', passed: true },
]

function renderBadge(props) {
  return render(
    <App>
      <VerifiedEmployerBadge {...props} />
    </App>,
  )
}

describe('VerifiedEmployerBadge', () => {
  it('lists every criterion sent by the backend on hover', async () => {
    renderBadge({ verification: { verified: true, criteria: CRITERIA } })

    await userEvent.hover(screen.getByLabelText('Nhà tuyển dụng đã được xác thực, xem 5 tiêu chí'))

    for (const item of CRITERIA) {
      expect(await screen.findByText(item.label)).toBeInTheDocument()
    }
  })

  it('opens the criteria from keyboard focus', async () => {
    renderBadge({ verification: { verified: true, criteria: CRITERIA } })

    await userEvent.tab()

    expect(screen.getByLabelText('Nhà tuyển dụng đã được xác thực, xem 5 tiêu chí')).toHaveFocus()
    expect(await screen.findByText(CRITERIA[0].label)).toBeInTheDocument()
  })

  it('renders nothing when a criterion has not been met', () => {
    // Dấu mờ trên tin chưa đủ điều kiện khiến tin thường trông như bị đánh dấu xấu.
    const criteria = CRITERIA.map((item, index) => ({ ...item, passed: index !== 3 }))
    const { container } = renderBadge({ verification: { verified: false, criteria } })

    expect(container.querySelector('.anticon')).toBeNull()
  })

  it('renders nothing for an unverified employer without a breakdown', () => {
    const { container } = renderBadge({ verified: false })

    expect(container.querySelector('.anticon')).toBeNull()
  })
})
