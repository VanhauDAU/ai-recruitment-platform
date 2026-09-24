import { render, screen } from '@testing-library/react'
import { App } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import EmployerGeneralSettings from './EmployerGeneralSettings'

// Hành vi MFA được kiểm ở `features/two-factor/ui/TwoFactorMethodsPanel.test.jsx`;
// ở đây chỉ khẳng định widget employer còn card thông báo và có gắn panel dùng chung.
vi.mock('@/features/two-factor', () => ({
  TwoFactorMethodsPanel: () => <div data-testid="two-factor-methods-panel" />,
}))
vi.mock('@/features/configure-employer-notifications', () => ({
  EmployerNotificationPreferences: () => <div data-testid="employer-notification-preferences" />,
}))

describe('EmployerGeneralSettings', () => {
  it('renders the recruiter notification card next to the shared MFA panel', () => {
    render(
      <App>
        <EmployerGeneralSettings />
      </App>,
    )

    expect(screen.getByText('Thông báo CV ứng tuyển')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByTestId('employer-notification-preferences')).toBeInTheDocument()
    expect(screen.getByTestId('two-factor-methods-panel')).toBeInTheDocument()
  })
})
