import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import EmployerAccountInformationPage from './AccountInformation'

vi.mock('@/widgets/employer/account-settings', () => ({
  EmployerAccountSettingsShell: ({ children }) => <main>{children}</main>,
  EmployerAccountInformation: () => <p>Thẻ thông tin</p>,
  EmployerAccountVerificationCard: () => <p>Thẻ cấp xác thực</p>,
}))
vi.mock('@/features/employer/account/verify-company-domain', () => ({ EmployerCompanyDomainVerification: () => <p>Thẻ tên miền</p> }))
vi.mock('@/features/employer/account/verify-employer-account', () => ({ EmployerTrustBadgeEligibility: () => <p>Thẻ dấu tick</p> }))

function Search() {
  return <output>{useLocation().search}</output>
}

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <EmployerAccountInformationPage />
    <Search />
  </MemoryRouter>,
)

describe('EmployerAccountInformationPage', () => {
  it('opens the tab named in the URL and keeps the URL in sync', async () => {
    const user = userEvent.setup()
    renderAt('/tuyendung/app/cai-dat/thong-tin-tai-khoan?tab=domain')
    expect(screen.getByRole('tab', { name: 'Tên miền công ty' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Thẻ tên miền')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Xác thực' }))
    expect(screen.getByText('Thẻ cấp xác thực')).toBeInTheDocument()
    expect(screen.getByText('Thẻ dấu tick')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('?tab=verification')

    await user.click(screen.getByRole('tab', { name: 'Tài khoản' }))
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('falls back to the account tab for an unknown tab', () => {
    renderAt('/tuyendung/app/cai-dat/thong-tin-tai-khoan?tab=khac')
    expect(screen.getByRole('tab', { name: 'Tài khoản' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Thẻ thông tin')).toBeInTheDocument()
  })
})
