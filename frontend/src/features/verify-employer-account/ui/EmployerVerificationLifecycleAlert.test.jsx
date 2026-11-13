import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EmployerVerificationLifecycleAlert from './EmployerVerificationLifecycleAlert'

describe('EmployerVerificationLifecycleAlert', () => {
  it('explains a revoked case without rewriting document review history', () => {
    render(<EmployerVerificationLifecycleAlert verificationCase={{
      status: 'revoked',
      decision_reason: 'Giấy phép không còn hiệu lực.',
    }} />)

    expect(screen.getByText('Xác thực nhà tuyển dụng đã bị thu hồi')).toBeVisible()
    expect(screen.getByText(/Giấy phép không còn hiệu lực/)).toBeVisible()
    expect(screen.getByText(/chỉ là kết quả kiểm tra của lần trước/)).toBeVisible()
  })

  it('stays hidden for an approved case', () => {
    const { container } = render(
      <EmployerVerificationLifecycleAlert verificationCase={{ status: 'approved' }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
